const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const {execSync} = require('child_process');

const {
  getNextVersion, isReleasingVersion, isStagingVersion
} = require('./utils');

const BASE = path.resolve(__dirname, "../");
const pkgData = JSON.parse(fse.readFileSync(path.resolve(BASE, "./package.json"), 'utf8'));
const isCi = !!process.env.CI;

const OPTIONS = { cwd: BASE};

const CUR_VER = pkgData.version;

if (isStagingVersion(CUR_VER)){

  const PUBLISH_CMD = isCi? "npm run build && npm publish --tag beta --access public" :
    "npm run build && npm publish --tag beta --access public --dry-run";
  const NEXT_VERSION = getNextVersion(pkgData.version);

  execSync("npm run build", OPTIONS);
  execSync(PUBLISH_CMD, OPTIONS);
  execSync(`npm version ${NEXT_VERSION}`, OPTIONS);

}
