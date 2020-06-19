const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const {execSync} = require('child_process');

const {
  getNextVersion, isReleasingVersion, isStagingVersion
} = require('./utils');

const BASE = path.resolve(__dirname, "../");
const pkgData = JSON.parse(fse.readFileSync(path.resolve(BASE, "./package.json"), 'utf8'));
const isCi = !!process.env.OTP_CODE;

const OPTIONS = { cwd: BASE };

const CUR_VER = pkgData.version;

if (isStagingVersion(CUR_VER)){

  const PUBLISH_CMD = isCi? `npm run build && npm publish --otp=${process.env.OTP_CODE} --tag beta --access public` :
    "npm run build && npm publish --tag beta --access public --dry-run";
  const NEXT_VERSION = getNextVersion(pkgData.version);
  const STAGING_COMMENT_TAG = `Staging ${CUR_VER} at ${new Date().toString()}`;
  const STAGING_COMMENT_COMMIT = `Bumping version upto ${NEXT_VERSION}`;

  execSync("npm run build", OPTIONS);
  execSync(PUBLISH_CMD, OPTIONS);
  execSync(`git tag -m "${STAGING_COMMENT_TAG}" v${CUR_VER}`, OPTIONS);
  isCi || execSync(`git push origin v${CUR_VER}`, OPTIONS);
  execSync(`npm version ${NEXT_VERSION} --no-git-tag-version`, OPTIONS);
  execSync(`git add --all`, OPTIONS);
  execSync(`git commit -am "${STAGING_COMMENT_COMMIT}"`, OPTIONS);
  isCi || execSync(`git push origin develop`, OPTIONS);
  execSync(`git status`, OPTIONS);

}
