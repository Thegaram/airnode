// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../interfaces/IAirnode.sol";
import "./interfaces/ISelfAuthorizer.sol";

/// @title Authorizer contract where each provider is their own admin
/// @notice This contract is for when the provider admin will manage access
/// personally. The provider admin can also appoint admins (either wallets or
/// contracts) to extend whitelistings up to a limited length. The admins
/// cannot revoke whitelistings, but the provider admin can.
contract SelfAuthorizer is ISelfAuthorizer {
    struct Admin {
        bool status;
        uint256 maxWhitelistExtension;
        }

    IAirnode public airnode;
    uint256 public immutable authorizerType = 2;
    mapping(bytes32 => mapping(address => Admin)) public providerIdToAdmins;
    mapping(bytes32 => mapping(address => uint256)) public
        providerIdToClientAddressToWhitelistExpiration;
    mapping(bytes32 => mapping(uint256 => uint256)) public
        providerIdToRequesterIndexToWhitelistExpiration;
    mapping(bytes32 => mapping(bytes32 => mapping(address => uint256))) public
        providerIdToEndpointIdToClientAddressToWhitelistExpiration;
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => uint256))) public
        providerIdToEndpointIdToRequesterIndexToWhitelistExpiration;

    /// @dev Reverts if the caller is not the provider admin
    /// @param providerId Provider ID from `ProviderStore.sol`
    modifier onlyProviderAdmin(bytes32 providerId)
    {
        (address providerAdmin, ) = airnode.getProvider(providerId);
        require(
            msg.sender == providerAdmin,
            "Caller is not provider admin"
            );
        _;
    }

    /// @dev Reverts if the caller is not an admin
    modifier onlyAdmin(bytes32 providerId)
    {
        require(
            providerIdToAdmins[providerId][msg.sender].status,
            "Caller is not an admin"
            );
        _;
    }

    /// @dev Reverts if `whitelistExpiration` is not in the future or is too
    /// far in the future
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param whitelistExpiration Timestamp at which the whitelisting will
    /// expire
    modifier onlyValidExpiration(
        bytes32 providerId,
        uint256 whitelistExpiration
        )
    {
        require(
            // solhint-disable-next-line not-rely-on-time
            whitelistExpiration >= now,
            "Expiration is in past"
            );
        require(
            // solhint-disable-next-line not-rely-on-time
            whitelistExpiration <= now + providerIdToAdmins[providerId][msg.sender].maxWhitelistExtension,
            "Expiration exceeds admin limit"
            );
        _;
    }

    /// @param _airnode Airnode contract address
    constructor (address _airnode)
        public
    {
        airnode = IAirnode(_airnode);
    }

    /// @notice Called by the provider admin to set the adminship parameters
    /// of an address
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param adminAddress Address whose adminship parameters will be set
    /// @param status Adminship status
    /// @param maxWhitelistExtension Amount that the respective admin can
    /// extend the whitelistings for
    function setAdminParameters(
        bytes32 providerId,
        address adminAddress,
        bool status,
        uint256 maxWhitelistExtension
        )
        external
        override
        onlyProviderAdmin(providerId)
    {
        providerIdToAdmins[providerId][adminAddress] = Admin(
            status,
            maxWhitelistExtension
            );
        emit AdminParametersSet(
            providerId,
            adminAddress,
            status,
            maxWhitelistExtension
            );
    }

    /// @notice Called by the admin to renounce their adminship
    /// @param providerId Provider ID from `ProviderStore.sol`
    function renounceAdminship(bytes32 providerId)
        external
        override
        onlyAdmin(providerId)
    {
        providerIdToAdmins[providerId][msg.sender].status = false;
        emit AdminshipRenounced(
            providerId,
            msg.sender
            );
    }

    /// @notice Called by the admin to extend the whitelisting of a client
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param clientAddress Client address
    /// @param whitelistExpiration Timestamp at which the whitelisting of the
    /// client will expire
    function extendClientWhitelistingForProvider(
        bytes32 providerId,
        address clientAddress,
        uint256 whitelistExpiration
        )
        external
        override
        onlyAdmin(providerId)
        onlyValidExpiration(
            providerId,
            whitelistExpiration
            )
    {
        require(
            whitelistExpiration > providerIdToClientAddressToWhitelistExpiration[providerId][clientAddress],
            "Expiration does not extend"
            );
        providerIdToClientAddressToWhitelistExpiration[providerId][clientAddress] = whitelistExpiration;
        emit ClientWhitelistingForProviderExtended(
            providerId,
            clientAddress,
            whitelistExpiration,
            msg.sender
            );
    }

    /// @notice Called by the admin to extend the whitelisting of a requester
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param requesterIndex Requester index from `RequesterStore.sol`
    /// @param whitelistExpiration Timestamp at which the whitelisting of the
    /// requester will expire
    function extendRequesterWhitelistingForProvider(
        bytes32 providerId,
        uint256 requesterIndex,
        uint256 whitelistExpiration
        )
        external
        override
        onlyAdmin(providerId)
        onlyValidExpiration(
            providerId,
            whitelistExpiration
            )
    {
        require(
            whitelistExpiration > providerIdToRequesterIndexToWhitelistExpiration[providerId][requesterIndex],
            "Expiration does not extend"
            );
        providerIdToRequesterIndexToWhitelistExpiration[providerId][requesterIndex] = whitelistExpiration;
        emit RequesterWhitelistingForProviderExtended(
            providerId,
            requesterIndex,
            whitelistExpiration,
            msg.sender
            );
    }

    /// @notice Called by the admin to extend the whitelisting of a client for
    /// making requests to the endpoint of the provider
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param endpointId Endpoint ID
    /// @param clientAddress Client address
    /// @param whitelistExpiration Timestamp at which the whitelisting of the
    /// client will expire
    function extendClientWhitelistingForEndpoint(
        bytes32 providerId,
        bytes32 endpointId,
        address clientAddress,
        uint256 whitelistExpiration
        )
        external
        override
        onlyAdmin(providerId)
        onlyValidExpiration(
            providerId,
            whitelistExpiration
            )
    {
        require(
            whitelistExpiration > providerIdToEndpointIdToClientAddressToWhitelistExpiration[providerId][endpointId][clientAddress],
            "Expiration does not extend"
            );
        providerIdToEndpointIdToClientAddressToWhitelistExpiration[providerId][endpointId][clientAddress] = whitelistExpiration;
        emit ClientWhitelistingForEndpointExtended(
            providerId,
            endpointId,
            clientAddress,
            whitelistExpiration,
            msg.sender
            );
    }

    /// @notice Called by the admin to extend the whitelisting of a requester
    /// for making requests to the endpoint of the provider
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param endpointId Endpoint ID
    /// @param requesterIndex Requester index from `RequesterStore.sol`
    /// @param whitelistExpiration Timestamp at which the whitelisting of the
    /// requester will expire
    function extendRequesterWhitelistingForEndpoint(
        bytes32 providerId,
        bytes32 endpointId,
        uint256 requesterIndex,
        uint256 whitelistExpiration
        )
        external
        override
        onlyAdmin(providerId)
        onlyValidExpiration(
            providerId,
            whitelistExpiration
            )
    {
        require(
            whitelistExpiration > providerIdToEndpointIdToRequesterIndexToWhitelistExpiration[providerId][endpointId][requesterIndex],
            "Expiration does not extend"
            );
        providerIdToEndpointIdToRequesterIndexToWhitelistExpiration[providerId][endpointId][requesterIndex] = whitelistExpiration;
        emit RequesterWhitelistingForEndpointExtended(
            providerId,
            endpointId,
            requesterIndex,
            whitelistExpiration,
            msg.sender
            );
    }

    /// @notice Called by the provider admin to set the whitelisting expiration
    /// time of the client for the provider
    /// @dev Note that the provider admin can use this method to set the
    /// client's `whitelistExpiration` to `0`, effectively blacklisting them
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param clientAddress Client address
    /// @param whitelistExpiration Timestamp at which the whitelisting of the
    /// client will expire
    function setClientWhitelistExpirationForProvider(
        bytes32 providerId,
        address clientAddress,
        uint256 whitelistExpiration
        )
        external
        override
        onlyProviderAdmin(providerId)
    {
        providerIdToClientAddressToWhitelistExpiration[providerId][clientAddress] = whitelistExpiration;
        emit ClientWhitelistForProviderExpirationSet(
            providerId,
            clientAddress,
            whitelistExpiration
            );
    }

    /// @notice Called by the provider admin to set the whitelisting expiration
    /// time of the requester for the provider
    /// @dev Note that the provider admin can use this method to set the
    /// requester's `whitelistExpiration` to `0`, effectively blacklisting them
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param requesterIndex Requester index from `RequesterStore.sol`
    /// @param whitelistExpiration Timestamp at which the whitelisting of the
    /// requester will expire
    function setRequesterWhitelistExpirationForProvider(
        bytes32 providerId,
        uint256 requesterIndex,
        uint256 whitelistExpiration
        )
        external
        override
        onlyProviderAdmin(providerId)
    {
        providerIdToRequesterIndexToWhitelistExpiration[providerId][requesterIndex] = whitelistExpiration;
        emit RequesterWhitelistForProviderExpirationSet(
            providerId,
            requesterIndex,
            whitelistExpiration
            );
    }

    /// @notice Called by the provider admin to set the whitelisting expiration
    /// time of the client for the endpoint of the provider
    /// @dev Note that the provider admin can use this method to set the
    /// client's `whitelistExpiration` to `0`, effectively blacklisting them
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param endpointId Endpoint ID
    /// @param clientAddress Client address
    /// @param whitelistExpiration Timestamp at which the whitelisting of the
    /// client will expire
    function setClientWhitelistExpirationForEndpoint(
        bytes32 providerId,
        bytes32 endpointId,
        address clientAddress,
        uint256 whitelistExpiration
        )
        external
        override
        onlyProviderAdmin(providerId)
    {
        providerIdToEndpointIdToClientAddressToWhitelistExpiration[providerId][endpointId][clientAddress] = whitelistExpiration;
        emit ClientWhitelistForEndpointExpirationSet(
            providerId,
            endpointId,
            clientAddress,
            whitelistExpiration
            );
    }

    /// @notice Called by the provider admin to set the whitelisting expiration
    /// time of the requester for the endpoint of the provider
    /// @dev Note that the provider admin can use this method to set the
    /// requester's `whitelistExpiration` to `0`, effectively blacklisting them
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param endpointId Endpoint ID
    /// @param requesterIndex Requester index from `RequesterStore.sol`
    /// @param whitelistExpiration Timestamp at which the whitelisting of the
    /// requester will expire
    function setRequesterWhitelistExpirationForEndpoint(
        bytes32 providerId,
        bytes32 endpointId,
        uint256 requesterIndex,
        uint256 whitelistExpiration
        )
        external
        override
        onlyProviderAdmin(providerId)
    {
        providerIdToEndpointIdToRequesterIndexToWhitelistExpiration[providerId][endpointId][requesterIndex] = whitelistExpiration;
        emit RequesterWhitelistForEndpointExpirationSet(
            providerId,
            endpointId,
            requesterIndex,
            whitelistExpiration
            );
    }

    /// @notice Verifies the authorization status of a request
    /// @dev This method has redundant arguments because all authorizer
    /// contracts have to have the same interface and potential authorizer
    /// contracts may require to access the arguments that are redundant here.
    /// Note that we are also validating that the `designatedWallet` balance is
    /// not `0`. The ideal condition to check would be if the
    /// `designatedWallet` has enough funds to fulfill the request. However,
    /// that is not a condition that can be checked deterministically.
    /// @param requestId Request ID
    /// @param providerId Provider ID from `ProviderStore.sol`
    /// @param endpointId Endpoint ID
    /// @param requesterIndex Requester index from `RequesterStore.sol`
    /// @param designatedWallet Designated wallet
    /// @param clientAddress Client address
    /// @return status Authorization status of the request
    function checkIfAuthorized(
        bytes32 requestId,        // solhint-disable-line no-unused-vars
        bytes32 providerId,
        bytes32 endpointId,       // solhint-disable-line no-unused-vars
        uint256 requesterIndex,
        address designatedWallet,
        address clientAddress
        )
        external
        view
        override
        returns (bool status)
    {
        return designatedWallet.balance != 0
            // solhint-disable-next-line not-rely-on-time
            && (providerIdToClientAddressToWhitelistExpiration[providerId][clientAddress] > now
            // solhint-disable-next-line not-rely-on-time
            || providerIdToRequesterIndexToWhitelistExpiration[providerId][requesterIndex] > now);
    }
}
