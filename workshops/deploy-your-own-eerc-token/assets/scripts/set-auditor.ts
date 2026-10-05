// Makes the deployer account the auditor. Owner only; the auditor must already be registered.
// Run with:
//   npx hardhat run scripts/set-auditor.ts --network fuji
import { ethers } from "hardhat";
import { getContracts } from "./lib";

const main = async () => {
	const [owner] = await ethers.getSigners();
	const { encryptedERC } = await getContracts();

	const tx = await encryptedERC.setAuditorPublicKey(owner.address);
	await tx.wait();

	const key = await encryptedERC.auditorPublicKey();
	console.log(`Auditor set to ${owner.address}. tx: ${tx.hash}`);
	console.log(`  auditor public key: [${key.x}, ${key.y}]`);
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
