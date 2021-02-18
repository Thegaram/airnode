const { expect } = require('chai');

let roles;
let selfAuthorizer;
let airnode;
let providerId;
const requesterIndex = 123;
const adminMaxWhitelistExtension = 100;
const requestId = ethers.utils.hexlify(ethers.utils.randomBytes(32));
const endpointId = ethers.utils.hexlify(ethers.utils.randomBytes(32));

beforeEach(async () => {
  const accounts = await ethers.getSigners();
  roles = {
    deployer: accounts[0],
    providerMasterWallet: accounts[1],
    providerAdmin: accounts[2],
    admin: accounts[3],
    client: accounts[4],
    randomPerson: accounts[9],
  };
  const airnodeFactory = await ethers.getContractFactory('Airnode', roles.deployer);
  airnode = await airnodeFactory.deploy();
  const selfAuthorizerFactory = await ethers.getContractFactory('SelfAuthorizer', roles.deployer);
  selfAuthorizer = await selfAuthorizerFactory.deploy(airnode.address);
  providerId = await airnode
    .connect(roles.providerMasterWallet)
    .callStatic.createProvider(roles.providerAdmin.address, 'xpub...');
  await airnode.connect(roles.providerMasterWallet).createProvider(roles.providerAdmin.address, 'xpub...');
});

describe('constructor', function () {
  it('initializes correctly', async function () {
    expect(await selfAuthorizer.authorizerType()).to.equal(2);
    expect(await selfAuthorizer.airnode()).to.equal(airnode.address);
  });
});

describe('setAdminParameters', function () {
  context('Caller is the provider admin', async function () {
    it('sets admin parameters', async function () {
      // Give adminship
      await expect(
        selfAuthorizer
          .connect(roles.providerAdmin)
          .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension)
      )
        .to.emit(selfAuthorizer, 'AdminParametersSet')
        .withArgs(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
      expect((await selfAuthorizer.providerIdToAdmins(providerId, roles.admin.address)).status).to.equal(true);
      expect((await selfAuthorizer.providerIdToAdmins(providerId, roles.admin.address)).maxWhitelistExtension).to.equal(
        adminMaxWhitelistExtension
      );
      // Revoke adminship
      await expect(
        selfAuthorizer
          .connect(roles.providerAdmin)
          .setAdminParameters(providerId, roles.admin.address, false, adminMaxWhitelistExtension * 2)
      )
        .to.emit(selfAuthorizer, 'AdminParametersSet')
        .withArgs(providerId, roles.admin.address, false, adminMaxWhitelistExtension * 2);
      expect((await selfAuthorizer.providerIdToAdmins(providerId, roles.admin.address)).status).to.equal(false);
      expect((await selfAuthorizer.providerIdToAdmins(providerId, roles.admin.address)).maxWhitelistExtension).to.equal(
        adminMaxWhitelistExtension * 2
      );
    });
  });
  context('Caller is not the provider admin', async function () {
    it('reverts', async function () {
      await expect(
        selfAuthorizer
          .connect(roles.randomPerson)
          .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension)
      ).to.be.revertedWith('Caller is not provider admin');
    });
  });
});

describe('renounceAdminship', function () {
  context('Caller is an admin', async function () {
    it('renounces adminship', async function () {
      await selfAuthorizer
        .connect(roles.providerAdmin)
        .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
      await expect(selfAuthorizer.connect(roles.admin).renounceAdminship(providerId))
        .to.emit(selfAuthorizer, 'AdminshipRenounced')
        .withArgs(providerId, roles.admin.address);
    });
  });
  context('Caller is not an admin', async function () {
    it('revert', async function () {
      await expect(selfAuthorizer.connect(roles.randomPerson).renounceAdminship(providerId)).to.be.revertedWith(
        'Caller is not an admin'
      );
    });
  });
});

describe('extendClientWhitelistingForProvider', function () {
  context('Caller is an admin', async function () {
    context('Expiration is not in past', async function () {
      context('Expiration does not exceed admin limit', async function () {
        context('Expiration does extend whitelisting', async function () {
          it('extends client whitelisting', async function () {
            await selfAuthorizer
              .connect(roles.providerAdmin)
              .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
            const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
            await expect(
              selfAuthorizer
                .connect(roles.admin)
                .extendClientWhitelistingForProvider(
                  providerId,
                  roles.client.address,
                  now + adminMaxWhitelistExtension / 2
                )
            )
              .to.emit(selfAuthorizer, 'ClientWhitelistingExtended')
              .withArgs(providerId, roles.client.address, now + adminMaxWhitelistExtension / 2, roles.admin.address);
            expect(
              await selfAuthorizer.providerIdToClientAddressToWhitelistExpiration(providerId, roles.client.address)
            ).to.equal(now + adminMaxWhitelistExtension / 2);
          });
        });
        context('Expiration does not extend whitelisting', async function () {
          it('reverts', async function () {
            await selfAuthorizer
              .connect(roles.providerAdmin)
              .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
            const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
            await selfAuthorizer
              .connect(roles.admin)
              .extendClientWhitelistingForProvider(
                providerId,
                roles.client.address,
                now + adminMaxWhitelistExtension / 2
              );
            await expect(
              selfAuthorizer
                .connect(roles.admin)
                .extendClientWhitelistingForProvider(
                  providerId,
                  roles.client.address,
                  now + adminMaxWhitelistExtension / 2
                )
            ).to.be.revertedWith('Expiration does not extend');
          });
        });
      });
      context('Expiration exceed admin limit', async function () {
        it('reverts', async function () {
          await selfAuthorizer
            .connect(roles.providerAdmin)
            .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
          const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
          await expect(
            selfAuthorizer
              .connect(roles.admin)
              .extendClientWhitelistingForProvider(
                providerId,
                roles.client.address,
                now + adminMaxWhitelistExtension * 2
              )
          ).to.be.revertedWith('Expiration exceeds admin limit');
        });
      });
    });
    context('Expiration is in past', async function () {
      it('reverts', async function () {
        await selfAuthorizer
          .connect(roles.providerAdmin)
          .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
        const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
        await expect(
          selfAuthorizer
            .connect(roles.admin)
            .extendClientWhitelistingForProvider(providerId, roles.client.address, now - adminMaxWhitelistExtension)
        ).to.be.revertedWith('Expiration is in past');
      });
    });
  });
  context('Caller is not an admin', async function () {
    it('reverts', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        selfAuthorizer
          .connect(roles.admin)
          .extendClientWhitelistingForProvider(providerId, roles.client.address, now + adminMaxWhitelistExtension / 2)
      ).to.be.revertedWith('Caller is not an admin');
    });
  });
});

describe('extendRequesterWhitelistingForProvider', function () {
  context('Caller is an admin', async function () {
    context('Expiration is not in past', async function () {
      context('Expiration does not exceed admin limit', async function () {
        context('Expiration does extend whitelisting', async function () {
          it('extends requester whitelisting', async function () {
            await selfAuthorizer
              .connect(roles.providerAdmin)
              .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
            const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
            await expect(
              selfAuthorizer
                .connect(roles.admin)
                .extendRequesterWhitelistingForProvider(
                  providerId,
                  requesterIndex,
                  now + adminMaxWhitelistExtension / 2
                )
            )
              .to.emit(selfAuthorizer, 'RequesterWhitelistingExtended')
              .withArgs(providerId, requesterIndex, now + adminMaxWhitelistExtension / 2, roles.admin.address);
            expect(
              await selfAuthorizer.providerIdToRequesterIndexToWhitelistExpiration(providerId, requesterIndex)
            ).to.equal(now + adminMaxWhitelistExtension / 2);
          });
        });
        context('Expiration does not extend whitelisting', async function () {
          it('reverts', async function () {
            await selfAuthorizer
              .connect(roles.providerAdmin)
              .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
            const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
            await selfAuthorizer
              .connect(roles.admin)
              .extendRequesterWhitelistingForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension / 2);
            await expect(
              selfAuthorizer
                .connect(roles.admin)
                .extendRequesterWhitelistingForProvider(
                  providerId,
                  requesterIndex,
                  now + adminMaxWhitelistExtension / 2
                )
            ).to.be.revertedWith('Expiration does not extend');
          });
        });
      });
      context('Expiration exceed admin limit', async function () {
        it('reverts', async function () {
          await selfAuthorizer
            .connect(roles.providerAdmin)
            .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
          const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
          await expect(
            selfAuthorizer
              .connect(roles.admin)
              .extendRequesterWhitelistingForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2)
          ).to.be.revertedWith('Expiration exceeds admin limit');
        });
      });
    });
    context('Expiration is in past', async function () {
      it('reverts', async function () {
        await selfAuthorizer
          .connect(roles.providerAdmin)
          .setAdminParameters(providerId, roles.admin.address, true, adminMaxWhitelistExtension);
        const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
        await expect(
          selfAuthorizer
            .connect(roles.admin)
            .extendRequesterWhitelistingForProvider(providerId, requesterIndex, now - adminMaxWhitelistExtension)
        ).to.be.revertedWith('Expiration is in past');
      });
    });
  });
  context('Caller is not an admin', async function () {
    it('reverts', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        selfAuthorizer
          .connect(roles.admin)
          .extendRequesterWhitelistingForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension / 2)
      ).to.be.revertedWith('Caller is not an admin');
    });
  });
});

describe('setClientWhitelistExpirationForProvider', function () {
  context('Caller is the provider admin', async function () {
    it('sets client whitelist expiration', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        selfAuthorizer
          .connect(roles.providerAdmin)
          .setClientWhitelistExpirationForProvider(
            providerId,
            roles.client.address,
            now + adminMaxWhitelistExtension * 2
          )
      )
        .to.emit(selfAuthorizer, 'ClientWhitelistExpirationSet')
        .withArgs(providerId, roles.client.address, now + adminMaxWhitelistExtension * 2);
    });
  });
  context('Caller is not the provider admin', async function () {
    it('reverts', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        selfAuthorizer
          .connect(roles.randomPerson)
          .setClientWhitelistExpirationForProvider(
            providerId,
            roles.client.address,
            now + adminMaxWhitelistExtension * 2
          )
      ).to.be.revertedWith('Caller is not provider admin');
    });
  });
});

describe('setRequesterWhitelistExpirationForProvider', function () {
  context('Caller is the provider admin', async function () {
    it('sets requester whitelist expiration', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        selfAuthorizer
          .connect(roles.providerAdmin)
          .setRequesterWhitelistExpirationForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2)
      )
        .to.emit(selfAuthorizer, 'RequesterWhitelistExpirationSet')
        .withArgs(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2);
    });
  });
  context('Caller is not the provider admin', async function () {
    it('reverts', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        selfAuthorizer
          .connect(roles.randomPerson)
          .setRequesterWhitelistExpirationForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2)
      ).to.be.revertedWith('Caller is not provider admin');
    });
  });
});

describe('checkIfAuthorized', function () {
  context('Designated wallet balance is not zero', async function () {
    context('Client is whitelisted', async function () {
      context('Requester is whitelisted', async function () {
        it('returns true', async function () {
          const designatedWallet = ethers.Wallet.createRandom();
          await roles.client.sendTransaction({
            to: designatedWallet.address,
            value: 1,
          });
          const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
          await selfAuthorizer
            .connect(roles.providerAdmin)
            .setClientWhitelistExpirationForProvider(
              providerId,
              roles.client.address,
              now + adminMaxWhitelistExtension * 2
            );
          await selfAuthorizer
            .connect(roles.providerAdmin)
            .setRequesterWhitelistExpirationForProvider(
              providerId,
              requesterIndex,
              now + adminMaxWhitelistExtension * 2
            );
          expect(
            await selfAuthorizer.checkIfAuthorized(
              requestId,
              providerId,
              endpointId,
              requesterIndex,
              designatedWallet.address,
              roles.client.address
            )
          ).to.equal(true);
        });
      });
      context('Requester is not whitelisted', async function () {
        it('returns true', async function () {
          const designatedWallet = ethers.Wallet.createRandom();
          await roles.client.sendTransaction({
            to: designatedWallet.address,
            value: 1,
          });
          const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
          await selfAuthorizer
            .connect(roles.providerAdmin)
            .setClientWhitelistExpirationForProvider(
              providerId,
              roles.client.address,
              now + adminMaxWhitelistExtension * 2
            );
          expect(
            await selfAuthorizer.checkIfAuthorized(
              requestId,
              providerId,
              endpointId,
              requesterIndex,
              designatedWallet.address,
              roles.client.address
            )
          ).to.equal(true);
        });
      });
    });
    context('Client is not whitelisted', async function () {
      context('Requester is whitelisted', async function () {
        it('returns true', async function () {
          const designatedWallet = ethers.Wallet.createRandom();
          await roles.client.sendTransaction({
            to: designatedWallet.address,
            value: 1,
          });
          const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
          await selfAuthorizer
            .connect(roles.providerAdmin)
            .setRequesterWhitelistExpirationForProvider(
              providerId,
              requesterIndex,
              now + adminMaxWhitelistExtension * 2
            );
          expect(
            await selfAuthorizer.checkIfAuthorized(
              requestId,
              providerId,
              endpointId,
              requesterIndex,
              designatedWallet.address,
              roles.client.address
            )
          ).to.equal(true);
        });
      });
      context('Requester is not whitelisted', async function () {
        it('returns false', async function () {
          const designatedWallet = ethers.Wallet.createRandom();
          await roles.client.sendTransaction({
            to: designatedWallet.address,
            value: 1,
          });
          expect(
            await selfAuthorizer.checkIfAuthorized(
              requestId,
              providerId,
              endpointId,
              requesterIndex,
              designatedWallet.address,
              roles.client.address
            )
          ).to.equal(false);
        });
      });
    });
  });
  context('Designated wallet balance is zero', async function () {
    it('returns false', async function () {
      const designatedWallet = ethers.Wallet.createRandom();
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await selfAuthorizer
        .connect(roles.providerAdmin)
        .setClientWhitelistExpirationForProvider(
          providerId,
          roles.client.address,
          now + adminMaxWhitelistExtension * 2
        );
      await selfAuthorizer
        .connect(roles.providerAdmin)
        .setRequesterWhitelistExpirationForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2);
      expect(
        await selfAuthorizer.checkIfAuthorized(
          requestId,
          providerId,
          endpointId,
          requesterIndex,
          designatedWallet.address,
          roles.client.address
        )
      ).to.equal(false);
    });
  });
});
