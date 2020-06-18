const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const {execSync} = require('child_process');

const {
  convertToReleasingVersion, isStagingVersion , isReleasingVersion
} = require('./utils');

const BASE = path.resolve(__dirname, "../");
const pkgData = JSON.parse(fse.readFileSync(path.resolve(BASE, "./package.json"), 'utf8'));
const isCi = !!process.env.CI;

const OPTIONS = { cwd: BASE };

const CUR_VER = pkgData.version;
const RELEASE_VER = convertToReleasingVersion(CUR_VER);
const RELEASE_BRANCH = `release/v${RELEASE_VER}`;
const RELEASE_COMMENT = `Start releasing ${RELEASE_VER} at ${new Date().toString()}`;

if (isStagingVersion(CUR_VER) && isReleasingVersion(RELEASE_VER)){
  execSync(`git branch ${RELEASE_BRANCH}`, OPTIONS);
  execSync(`git checkout ${RELEASE_BRANCH}`, OPTIONS);
  execSync(`npm version ${RELEASE_VER} --no-git-tag-version`, OPTIONS);
  execSync(`git add --all`, OPTIONS);
  execSync(`git commit -am "${RELEASE_COMMENT}"`, OPTIONS);
  execSync(`git push origin ${RELEASE_BRANCH}`, OPTIONS);
}
