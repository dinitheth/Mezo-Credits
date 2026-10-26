// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MezoFlow InvoiceRouter (Wave 1)
/// @notice Settles MUSD invoices with an EIP-712 delegation.
///  Struct-based params keep the stack shallow so stock Remix (0.8.20 +
///  optimizer, no viaIR) compiles cleanly.
interface IERC20 {
  function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract InvoiceRouter {
  struct Invoice {
    address payer;
    string id;
    uint256 amount;
    address to;
    string desc;
    uint256 deadline;
    string nonce;
  }

  IERC20 public immutable musd;

  bytes32 private constant DOMAIN_TYPEHASH =
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
  bytes32 private constant INVOICE_TYPEHASH =
    keccak256("Invoice(string id,uint256 amount,address to,string desc,uint256 deadline,string nonce)");
  bytes32 private immutable CACHED_DOMAIN_SEPARATOR;
  uint256 private immutable CACHED_CHAIN_ID;

  /// payer => nonce string => used (replay protection, no extra hash local)
  mapping(address => mapping(string => bool)) public nonceUsed;

  event InvoicePaid(
    string indexed id,
    address indexed payer,
    address indexed to,
    uint256 amount,
    string desc
  );

  error BadSignature();
  error Expired();
  error NonceUsed();
  error TransferFailed();

  constructor(address _musd) {
    musd = IERC20(_musd);
    CACHED_CHAIN_ID = block.chainid;
    CACHED_DOMAIN_SEPARATOR = _domainSeparator();
  }

  function domainSeparator() public view returns (bytes32) {
    return block.chainid == CACHED_CHAIN_ID ? CACHED_DOMAIN_SEPARATOR : _domainSeparator();
  }

  function _domainSeparator() private view returns (bytes32) {
    return keccak256(
      abi.encode(
        DOMAIN_TYPEHASH,
        keccak256(bytes("MezoFlow")),
        keccak256(bytes("1")),
        block.chainid,
        address(this)
      )
    );
  }

  function hashInvoice(Invoice calldata inv) public view returns (bytes32) {
    return keccak256(
      abi.encodePacked(
        "\x19\x01",
        domainSeparator(),
        keccak256(
          abi.encode(
            INVOICE_TYPEHASH,
            keccak256(bytes(inv.id)),
            inv.amount,
            inv.to,
            keccak256(bytes(inv.desc)),
            inv.deadline,
            keccak256(bytes(inv.nonce))
          )
        )
      )
    );
  }

  function _splitSig(bytes calldata sig) private pure returns (uint8 v, bytes32 r, bytes32 s) {
    require(sig.length == 65, "bad sig len");
    assembly {
      // `sig.offset` already points to the first signature byte. Starting at
      // +0x20 shifted every component and made ecrecover reject valid signatures.
      r := calldataload(sig.offset)
      s := calldataload(add(sig.offset, 0x20))
      v := byte(0, calldataload(add(sig.offset, 0x40)))
    }
    if (v < 27) v += 27;
  }

  function _verify(Invoice calldata inv, bytes calldata sig) internal view {
    (uint8 v, bytes32 r, bytes32 s) = _splitSig(sig);
    address signer = ecrecover(hashInvoice(inv), v, r, s);
    if (signer == address(0) || signer != inv.payer) revert BadSignature();
  }

  /// @dev Payer signs off-chain; anyone (merchant/relayer/payer) can submit.
  function payInvoice(Invoice calldata inv, bytes calldata sig) external {
    if (block.timestamp > inv.deadline) revert Expired();
    if (nonceUsed[inv.payer][inv.nonce]) revert NonceUsed();
    _verify(inv, sig);
    nonceUsed[inv.payer][inv.nonce] = true;

    bool ok = musd.transferFrom(inv.payer, inv.to, inv.amount);
    if (!ok) revert TransferFailed();

    emit InvoicePaid(inv.id, inv.payer, inv.to, inv.amount, inv.desc);
  }
}
