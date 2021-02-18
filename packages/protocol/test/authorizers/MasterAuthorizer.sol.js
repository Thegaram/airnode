const { expect } = require('chai');

let roles;
let masterAuthorizer;
const providerId = ethers.utils.hexlify(ethers.utils.randomBytes(32));
const requesterIndex = 123;
const adminMaxWhitelistExtension = 100;
const requestId = ethers.utils.hexlify(ethers.utils.randomBytes(32));
const endpointId = ethers.utils.hexlify(ethers.utils.randomBytes(32));

beforeEach(async () => {
  const accounts = await ethers.getSigners();
  roles = {
    deployer: accounts[0],
    masterAdmin: accounts[1],
    newMasterAdmin: accounts[2],
    admin: accounts[3],
    client: accounts[4],
    randomPerson: accounts[9],
  };
  const masterAuthorizerFactory = await ethers.getContractFactory('MasterAuthorizer', roles.deployer);
  masterAuthorizer = await masterAuthorizerFactory.deploy(roles.masterAdmin.address);
});

describe('constructor', function () {
  it('initializes correctly', async function () {
    expect(await masterAuthorizer.authorizerType()).to.equal(1);
    expect(await masterAuthorizer.masterAdmin()).to.equal(roles.masterAdmin.address);
  });
});

describe('transferMasterAdminship', function () {
  context('Caller is the master admin', async function () {
    context('Address to be transferred to is non-zero', async function () {
      context('Address to be transferred to is different', async function () {
        it('transfers master adminship', async function () {
          await expect(
            masterAuthorizer.connect(roles.masterAdmin).transferMasterAdminship(roles.newMasterAdmin.address)
          )
            .to.emit(masterAuthorizer, 'MasterAdminshipTransferred')
            .withArgs(roles.masterAdmin.address, roles.newMasterAdmin.address);
        });
      });
      context('Address to be transferred to is the same', async function () {
        it('reverts', async function () {
          await expect(
            masterAuthorizer.connect(roles.masterAdmin).transferMasterAdminship(roles.masterAdmin.address)
          ).to.be.revertedWith('Input will not update state');
        });
      });
    });
    context('Address to be transferred to is zero', async function () {
      it('reverts', async function () {
        await expect(
          masterAuthorizer.connect(roles.masterAdmin).transferMasterAdminship(ethers.constants.AddressZero)
        ).to.be.revertedWith('Used zero address');
      });
    });
  });
  context('Caller is not the master admin', async function () {
    it('reverts', async function () {
      await expect(
        masterAuthorizer.connect(roles.randomPerson).transferMasterAdminship(roles.newMasterAdmin.address)
      ).to.be.revertedWith('Caller is not master admin');
    });
  });
});

describe('setAdminParameters', function () {
  context('Caller is the master admin', async function () {
    it('sets admin parameters', async function () {
      // Give adminship
      await expect(
        masterAuthorizer
          .connect(roles.masterAdmin)
          .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension)
      )
        .to.emit(masterAuthorizer, 'AdminParametersSet')
        .withArgs(roles.admin.address, true, adminMaxWhitelistExtension);
      expect((await masterAuthorizer.admins(roles.admin.address)).status).to.equal(true);
      expect((await masterAuthorizer.admins(roles.admin.address)).maxWhitelistExtension).to.equal(
        adminMaxWhitelistExtension
      );
      // Revoke adminship
      await expect(
        masterAuthorizer
          .connect(roles.masterAdmin)
          .setAdminParameters(roles.admin.address, false, adminMaxWhitelistExtension * 2)
      )
        .to.emit(masterAuthorizer, 'AdminParametersSet')
        .withArgs(roles.admin.address, false, adminMaxWhitelistExtension * 2);
      expect((await masterAuthorizer.admins(roles.admin.address)).status).to.equal(false);
      expect((await masterAuthorizer.admins(roles.admin.address)).maxWhitelistExtension).to.equal(
        adminMaxWhitelistExtension * 2
      );
    });
  });
  context('Caller is not the master admin', async function () {
    it('reverts', async function () {
      await expect(
        masterAuthorizer
          .connect(roles.randomPerson)
          .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension)
      ).to.be.revertedWith('Caller is not master admin');
    });
  });
});

describe('renounceAdminship', function () {
  context('Caller is an admin', async function () {
    it('renounces adminship', async function () {
      await masterAuthorizer
        .connect(roles.masterAdmin)
        .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
      await expect(masterAuthorizer.connect(roles.admin).renounceAdminship())
        .to.emit(masterAuthorizer, 'AdminshipRenounced')
        .withArgs(roles.admin.address);
    });
  });
  context('Caller is not an admin', async function () {
    it('revert', async function () {
      await expect(masterAuthorizer.connect(roles.randomPerson).renounceAdminship()).to.be.revertedWith(
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
            await masterAuthorizer
              .connect(roles.masterAdmin)
              .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
            const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
            await expect(
              masterAuthorizer
                .connect(roles.admin)
                .extendClientWhitelistingForProvider(
                  providerId,
                  roles.client.address,
                  now + adminMaxWhitelistExtension / 2
                )
            )
              .to.emit(masterAuthorizer, 'ClientWhitelistingForProviderExtended')
              .withArgs(providerId, roles.client.address, now + adminMaxWhitelistExtension / 2, roles.admin.address);
            expect(
              await masterAuthorizer.providerIdToClientAddressToWhitelistExpiration(providerId, roles.client.address)
            ).to.equal(now + adminMaxWhitelistExtension / 2);
          });
        });
        context('Expiration does not extend whitelisting', async function () {
          it('reverts', async function () {
            await masterAuthorizer
              .connect(roles.masterAdmin)
              .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
            const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
            await masterAuthorizer
              .connect(roles.admin)
              .extendClientWhitelistingForProvider(
                providerId,
                roles.client.address,
                now + adminMaxWhitelistExtension / 2
              );
            await expect(
              masterAuthorizer
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
          await masterAuthorizer
            .connect(roles.masterAdmin)
            .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
          const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
          await expect(
            masterAuthorizer
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
        await masterAuthorizer
          .connect(roles.masterAdmin)
          .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
        const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
        await expect(
          masterAuthorizer
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
        masterAuthorizer
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
            await masterAuthorizer
              .connect(roles.masterAdmin)
              .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
            const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
            await expect(
              masterAuthorizer
                .connect(roles.admin)
                .extendRequesterWhitelistingForProvider(
                  providerId,
                  requesterIndex,
                  now + adminMaxWhitelistExtension / 2
                )
            )
              .to.emit(masterAuthorizer, 'RequesterWhitelistingForProviderExtended')
              .withArgs(providerId, requesterIndex, now + adminMaxWhitelistExtension / 2, roles.admin.address);
            expect(
              await masterAuthorizer.providerIdToRequesterIndexToWhitelistExpiration(providerId, requesterIndex)
            ).to.equal(now + adminMaxWhitelistExtension / 2);
          });
        });
        context('Expiration does not extend whitelisting', async function () {
          it('reverts', async function () {
            await masterAuthorizer
              .connect(roles.masterAdmin)
              .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
            const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
            await masterAuthorizer
              .connect(roles.admin)
              .extendRequesterWhitelistingForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension / 2);
            await expect(
              masterAuthorizer
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
          await masterAuthorizer
            .connect(roles.masterAdmin)
            .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
          const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
          await expect(
            masterAuthorizer
              .connect(roles.admin)
              .extendRequesterWhitelistingForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2)
          ).to.be.revertedWith('Expiration exceeds admin limit');
        });
      });
    });
    context('Expiration is in past', async function () {
      it('reverts', async function () {
        await masterAuthorizer
          .connect(roles.masterAdmin)
          .setAdminParameters(roles.admin.address, true, adminMaxWhitelistExtension);
        const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
        await expect(
          masterAuthorizer
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
        masterAuthorizer
          .connect(roles.admin)
          .extendRequesterWhitelistingForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension / 2)
      ).to.be.revertedWith('Caller is not an admin');
    });
  });
});

describe('setClientWhitelistExpirationForProvider', function () {
  context('Caller is the master admin', async function () {
    it('sets client whitelist expiration', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        masterAuthorizer
          .connect(roles.masterAdmin)
          .setClientWhitelistExpirationForProvider(
            providerId,
            roles.client.address,
            now + adminMaxWhitelistExtension * 2
          )
      )
        .to.emit(masterAuthorizer, 'ClientWhitelistExpirationSet')
        .withArgs(providerId, roles.client.address, now + adminMaxWhitelistExtension * 2);
    });
  });
  context('Caller is not the master admin', async function () {
    it('reverts', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        masterAuthorizer
          .connect(roles.randomPerson)
          .setClientWhitelistExpirationForProvider(
            providerId,
            roles.client.address,
            now + adminMaxWhitelistExtension * 2
          )
      ).to.be.revertedWith('Caller is not master admin');
    });
  });
});

describe('setRequesterWhitelistExpirationForProvider', function () {
  context('Caller is the master admin', async function () {
    it('sets requester whitelist expiration', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        masterAuthorizer
          .connect(roles.masterAdmin)
          .setRequesterWhitelistExpirationForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2)
      )
        .to.emit(masterAuthorizer, 'RequesterWhitelistExpirationSet')
        .withArgs(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2);
    });
  });
  context('Caller is not the master admin', async function () {
    it('reverts', async function () {
      const now = (await waffle.provider.getBlock(await waffle.provider.getBlockNumber())).timestamp;
      await expect(
        masterAuthorizer
          .connect(roles.randomPerson)
          .setRequesterWhitelistExpirationForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2)
      ).to.be.revertedWith('Caller is not master admin');
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
          await masterAuthorizer
            .connect(roles.masterAdmin)
            .setClientWhitelistExpirationForProvider(
              providerId,
              roles.client.address,
              now + adminMaxWhitelistExtension * 2
            );
          await masterAuthorizer
            .connect(roles.masterAdmin)
            .setRequesterWhitelistExpirationForProvider(
              providerId,
              requesterIndex,
              now + adminMaxWhitelistExtension * 2
            );
          expect(
            await masterAuthorizer.checkIfAuthorized(
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
          await masterAuthorizer
            .connect(roles.masterAdmin)
            .setClientWhitelistExpirationForProvider(
              providerId,
              roles.client.address,
              now + adminMaxWhitelistExtension * 2
            );
          expect(
            await masterAuthorizer.checkIfAuthorized(
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
          await masterAuthorizer
            .connect(roles.masterAdmin)
            .setRequesterWhitelistExpirationForProvider(
              providerId,
              requesterIndex,
              now + adminMaxWhitelistExtension * 2
            );
          expect(
            await masterAuthorizer.checkIfAuthorized(
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
            await masterAuthorizer.checkIfAuthorized(
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
      await masterAuthorizer
        .connect(roles.masterAdmin)
        .setClientWhitelistExpirationForProvider(
          providerId,
          roles.client.address,
          now + adminMaxWhitelistExtension * 2
        );
      await masterAuthorizer
        .connect(roles.masterAdmin)
        .setRequesterWhitelistExpirationForProvider(providerId, requesterIndex, now + adminMaxWhitelistExtension * 2);
      expect(
        await masterAuthorizer.checkIfAuthorized(
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
