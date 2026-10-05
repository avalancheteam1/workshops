// Deploys the full standalone eERC stack: 5 verifiers, the BabyJubJub library,
// the Registrar and the token. Run with:
//   npx hardhat run scripts/deploy.ts --network fuji
import { ethers } from "hardhat";
import { deployLibrary, deployVerifiers } from "../test/helpers";
import { EncryptedERC__factory } from "../typechain-types";

const main = async () => {
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// `false` = deploy the verifiers you generated in contracts/verifiers/.
	// `true` would deploy contracts/prod/, whose keys do not match your circuits.
	const verifiers = await deployVerifiers(deployer, false);

	const babyJubJub = await deployLibrary(deployer);

	const registrarFactory = await ethers.getContractFactory("Registrar");
	const registrar = await registrarFactory.deploy(verifiers.registrationVerifier);
	await registrar.waitForDeployment();

	// BabyJubJub is a linked library: its address is written into the token bytecode.
	const tokenFactory = new EncryptedERC__factory({
		"contracts/libraries/BabyJubJub.sol:BabyJubJub": babyJubJub,
	});
	const encryptedERC = await tokenFactory.connect(deployer).deploy({
		registrar: registrar.target,
		isConverter: false, // standalone token
		name: process.env.EERC_NAME ?? "Test",
		symbol: process.env.EERC_SYMBOL ?? "TEST",
		mintVerifier: verifiers.mintVerifier,
		withdrawVerifier: verifiers.withdrawVerifier,
		transferVerifier: verifiers.transferVerifier,
		burnVerifier: verifiers.burnVerifier,
		decimals: Number(process.env.EERC_DECIMALS ?? 2),
	});
	await encryptedERC.waitForDeployment();

	console.table({
		...verifiers,
		babyJubJub,
		registrar: registrar.target.toString(),
		encryptedERC: encryptedERC.target.toString(),
	});

	console.log("\nAdd these two lines to .env:");
	console.log(`REGISTRAR=${registrar.target}`);
	console.log(`ENCRYPTED_ERC=${encryptedERC.target}`);
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
