// Reads and decrypts the balance of every account in .env.
// Run with:
//   npx hardhat run scripts/balance.ts --network fuji
import { ethers } from "hardhat";
import { getDecryptedBalance } from "../test/helpers";
import { getContracts, loadUser } from "./lib";

const main = async () => {
	const { encryptedERC } = await getContracts();

	for (const signer of await ethers.getSigners()) {
		const user = loadUser(signer);

		// Step 1: fetch the ciphertexts. Anyone can do this.
		const balance = await encryptedERC.balanceOfStandalone(signer.address);

		// Step 2: decrypt them. Only the holder of the private key can do this.
		const total = await getDecryptedBalance(
			user.privateKey,
			balance.amountPCTs,
			balance.balancePCT,
			balance.eGCT,
		);

		console.log(`${signer.address}`);
		console.log(`  encrypted balance on-chain (c1): [${balance.eGCT.c1}]`);
		console.log(`  decrypted balance:              ${total} units`);
	}
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
