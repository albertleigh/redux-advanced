const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const {execSync} = require('child_process');

const {
  getNextVersion, convertToStagingVersion, isStagingVersion , isReleasingVersion
} = require('./utils');

const BASE = path.resolve(__dirname, "../");
const pkgData = JSON.parse(fse.readFileSync(path.resolve(BASE, "./package.json"), 'utf8'));
const isCi = !!process.env.CI;

const OPTIONS = { cwd: BASE };

const RELEASE_VER = pkgData.version;
const RELEASE_BRANCH = `release/v${RELEASE_VER}`;
const NEXT_BETA_VERSION = convertToStagingVersion(getNextVersion(RELEASE_VER));
const RELEASE_COMMENT_TAG = `Finish releasing ${RELEASE_VER} at ${new Date().toString()}`;
const RELEASE_COMMENT_COMMIT = `Bumping version upto ${NEXT_BETA_VERSION}`;

if (isReleasingVersion(CUR_VER)){
  execSync("npm run build", OPTIONS);
  execSync(`git tag -m ${RELEASE_COMMENT_TAG} v${CUR_VER}`, OPTIONS);
  execSync(`git push origin v${CUR_VER}`, OPTIONS);
  execSync(`npm version ${NEXT_BETA_VERSION} --no-git-tag-version`, OPTIONS);
  execSync(`git add --all`, OPTIONS);
  execSync(`git commit -am "${RELEASE_COMMENT_COMMIT}"`, OPTIONS);
  execSync(`git push origin ${RELEASE_BRANCH}`, OPTIONS);
  execSync(`git status`, OPTIONS);
  try{
    execSync(`git checkout develop`, OPTIONS);
    execSync(`git merge ${RELEASE_BRANCH}`, OPTIONS);
    execSync(`git push origin develop`, OPTIONS);
    execSync(`git status`, OPTIONS);
  } catch (e) {
    // eat the exception, in case unable to merge into develop
    // should not block the release
  }
}
