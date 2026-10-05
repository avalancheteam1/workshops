// Mints encrypted tokens to the deployer account. Owner only.
// Run with (AMOUNT is optional, default 1000 = 10.00 tokens at 2 decimals):
//   AMOUNT=1000 npx hardhat run scripts/mint.ts --network fuji
import { ethers } from "hardhat";
import { privateMint } from "../test/helpers";
import { amountFromEnv, getAuditorPublicKey, getContracts } from "./lib";

const main = async () => {
	const [owner] = await ethers.getSigners();
	const { registrar, encryptedERC } = await getContracts();
	const amount = amountFromEnv(1000n);

	// The amount is encrypted under the receiver's key and the auditor's key
	// inside the proof. The chain only ever sees ciphertexts.
	const receiverPublicKey = await registrar.getUserPublicKey(owner.address);
	const auditorPublicKey = await getAuditorPublicKey();

	console.log(`Generating mint proof for ${amount} units...`);
	const calldata = await privateMint(
		amount,
		[...receiverPublicKey],
		auditorPublicKey,
	);

	// privateMint is overloaded, so it is called by its full signature.
	const tx = await encryptedERC[
		"privateMint(address,((uint256[2],uint256[2][2],uint256[2]),uint256[24]))"
	](owner.address, {
		proofPoints: calldata.proofPoints,
		publicSignals: calldata.publicSignals,
	});
	const receipt = await tx.wait();

	console.log(`Minted ${amount} units to ${owner.address}. tx: ${tx.hash}`);
	console.log(`  gas used: ${receipt?.gasUsed}`);
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
