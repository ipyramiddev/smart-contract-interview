// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC20Upgradeable.sol";
import "./ReentrancyGuardUpgradeable.sol";
import "./ERC165Upgradeable.sol";
import "./NonblockingLzAppUpgradeable.sol";
import "../SafeERC20.sol";

contract NativeProxyOFT20Upgradeable is
    NonblockingLzAppUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC20Upgradeable,
    ERC165Upgradeable
{
    using SafeERC20 for IERC20;

    uint256 public constant NO_EXTRA_GAS = 0;
    uint256 public constant FUNCTION_TYPE_SEND = 1;
    bool public useCustomAdapterParams;

    event SendToChain(
        uint16 indexed _dstChainId,
        address indexed _from,
        bytes indexed _toAddress,
        uint256 _amount
    );
    event ReceiveFromChain(
        uint16 indexed _srcChainId,
        bytes indexed _srcAddress,
        address indexed _toAddress,
        uint256 _amount
    );

    // constructor(
    //     string memory _name,
    //     string memory _symbol,
    //     address _lzEndpoint
    // ) ERC20(_name, _symbol) NonblockingLzApp(_lzEndpoint) {}

    function __NativeProxyOFT20Upgradeable_init(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint
    ) internal onlyInitializing {
        __ERC20_init(_name, _symbol);
        __ERC165_init();
        __ReentrancyGuard_init();
        __NonBlockingLzApp_init(_lzEndpoint);
    }

    function estimateSendFee(
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount,
        bool _useZro,
        bytes memory _adapterParams
    ) public view returns (uint256 nativeFee, uint256 zroFee) {
        bytes memory payload = abi.encode(_toAddress, _amount);
        return
            lzEndpoint.estimateFees(
                _dstChainId,
                address(this),
                payload,
                _useZro,
                _adapterParams
            );
    }

    function sendFrom(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes memory _adapterParams
    ) public payable {
        _send(
            _from,
            _dstChainId,
            _toAddress,
            _amount,
            _refundAddress,
            _zroPaymentAddress,
            _adapterParams
        );
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory _payload
    ) internal virtual override {
        (bytes memory toAddressBytes, uint256 amount) = abi.decode(
            _payload,
            (bytes, uint256)
        );
        address toAddress;
        assembly {
            toAddress := mload(add(toAddressBytes, 20))
        }

        _creditTo(_srcChainId, toAddress, amount);

        emit ReceiveFromChain(_srcChainId, _srcAddress, toAddress, amount);
    }

    function _send(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes memory _adapterParams
    ) public payable {
        uint256 messageFee = _debitFrom(
            _from,
            _dstChainId,
            _toAddress,
            _amount
        );

        bytes memory payload = abi.encode(_toAddress, _amount);
        if (useCustomAdapterParams) {
            _checkGasLimit(
                _dstChainId,
                FUNCTION_TYPE_SEND,
                _adapterParams,
                NO_EXTRA_GAS
            );
        } else {
            require(
                _adapterParams.length == 0,
                "NativeProxyOFT20: _adapterParams must be empty."
            );
        }

        bytes memory trustedRemote = trustedRemoteLookup[_dstChainId];
        require(
            trustedRemote.length != 0,
            "NativeProxyOFT20: destination chain is not a trusted source"
        );
        lzEndpoint.send{value: messageFee}(
            _dstChainId,
            trustedRemote,
            payload,
            _refundAddress,
            _zroPaymentAddress,
            _adapterParams
        );
        emit SendToChain(_dstChainId, _from, _toAddress, _amount);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams)
        external
        onlyOwner
    {
        useCustomAdapterParams = _useCustomAdapterParams;
    }

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 _amount) external nonReentrant {
        require(
            balanceOf(msg.sender) >= _amount,
            "NativeProxyOFT20: Insufficient balance."
        );
        _burn(msg.sender, _amount);
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "NativeProxyOFT20: failed to unwrap");
    }

    function _debitFrom(
        address _from,
        uint16,
        bytes memory,
        uint256 _amount
    ) internal returns (uint256 messageFee) {
        messageFee = msg.sender == _from
            ? _debitMsgSender(_amount)
            : _debitMsgFrom(_from, _amount);
    }

    function _debitMsgSender(uint256 _amount)
        internal
        returns (uint256 messageFee)
    {
        uint256 msgSenderBalance = balanceOf(msg.sender);

        if (msgSenderBalance < _amount) {
            require(
                msgSenderBalance + msg.value >= _amount,
                "NativeProxyOFT20: Insufficient msg.value"
            );

            // user can cover difference with additional msg.value ie. wrapping
            uint256 mintAmount = _amount - msgSenderBalance;
            _mint(address(msg.sender), mintAmount);

            // update the messageFee to take out mintAmount
            messageFee = msg.value - mintAmount;
        } else {
            messageFee = msg.value;
        }

        _transfer(msg.sender, address(this), _amount);
        return messageFee;
    }

    function _debitMsgFrom(address _from, uint256 _amount)
        internal
        returns (uint256 messageFee)
    {
        uint256 msgFromBalance = balanceOf(_from);

        if (msgFromBalance < _amount) {
            require(
                msgFromBalance + msg.value >= _amount,
                "NativeProxyOFT20: Insufficient msg.value"
            );

            // user can cover difference with additional msg.value ie. wrapping
            uint256 mintAmount = _amount - msgFromBalance;
            _mint(address(msg.sender), mintAmount);

            // transfer the differential amount to the contract
            _transfer(msg.sender, address(this), mintAmount);

            // overwrite the _amount to take the rest of the balance from the _from address
            _amount = msgFromBalance;

            // update the messageFee to take out mintAmount
            messageFee = msg.value - mintAmount;
        } else {
            messageFee = msg.value;
        }

        _spendAllowance(_from, msg.sender, _amount);
        _transfer(_from, address(this), _amount);
        return messageFee;
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint256 _amount
    ) internal {
        _burn(address(this), _amount);
        (bool success, ) = _toAddress.call{value: _amount}("");
        require(success, "NativeProxyOFT20: failed to _creditTo");
    }
}
