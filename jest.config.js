const nextJest = require("next/jest");

// Os testes de integração usam o mesmo ambiente local de desenvolvimento.
process.loadEnvFile(".env.development");

const createJestConfig = nextJest({ dir: "." });

module.exports = createJestConfig({
  moduleDirectories: ["node_modules", "<rootDir>"],
  testTimeout: 60000,
  globalSetup: "<rootDir>/test/global-setup.js",
  globalTeardown: "<rootDir>/test/global-teardown.js",
});
