// Registers a BabyJubJub public key for every account in .env (PRIVATE_KEY, PRIVATE_KEY_2).
// Run with:
//   npx hardhat run scripts/register.ts --network fuji
import { ethers, zkit } from "hardhat";
import { getContracts, loadUser } from "./lib";

const main = async () => {
	const { registrar } = await getContracts();
	const { chainId } = await ethers.provider.getNetwork();
	const circuit = await zkit.getCircuit("RegistrationCircuit");

	for (const signer of await ethers.getSigners()) {
		if (await registrar.isUserRegistered(signer.address)) {
			console.log(`${signer.address} already registered, skipping`);
			continue;
		}

		const user = loadUser(signer);

		// The private key stays in this input object on your machine.
		// Only the proof and the public signals go on-chain.
		const proof = await circuit.generateProof({
			SenderPrivateKey: user.formattedPrivateKey,
			SenderPublicKey: user.publicKey,
			SenderAddress: BigInt(signer.address),
			ChainID: chainId,
			RegistrationHash: user.genRegistrationHash(chainId),
		});
		const calldata = await circuit.generateCalldata(proof);

		const tx = await registrar.connect(signer).register({
			proofPoints: calldata.proofPoints,
			publicSignals: calldata.publicSignals,
		});
		await tx.wait();

		console.log(`${signer.address} registered. tx: ${tx.hash}`);
		console.log(`  public key: [${user.publicKey[0]}, ${user.publicKey[1]}]`);
	}
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
