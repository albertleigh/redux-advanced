const DEFAULT_TAG = 'beta';
const HOT_FIX_TAG = 'alpha';

/**
 * Get the next patch/tag version
 *
 * 1.1.0-beta.0 -> 1.1.0-beta.1
 * 1.1.0 -> 1.1.1
 *
 * @param currentVersion
 * @returns next patch/tag version
 */
function getNextVersion(currentVersion){
  const parts = currentVersion.split('.');
  parts[parts.length-1] = parseInt(parts[parts.length-1], 10)+1;
  return parts.join('.');
}

function convertToHotFixVersion(version, tagNum = 0) {
  if (isReleasingVersion(version)){
    return `${version}-${HOT_FIX_TAG}.${!!tagNum?tagNum:0}`
  }else if (isHotfixVersion(version)){
    return version;
  }else {
    throw "Incorrect version string found";
  }
}

function convertToStagingVersion(version, tagNum = 0) {
  if (isReleasingVersion(version)){
    return `${version}-${DEFAULT_TAG}.${!!tagNum?tagNum:0}`
  }else if (isStagingVersion(version)){
    return version;
  }else {
    throw "Incorrect version string found";
  }
}

function convertToReleasingVersion(version) {
  if (isStagingVersion(version)){
    return version.substr(0, version.indexOf(`-${DEFAULT_TAG}`));
  }else if (isReleasingVersion(version)){
    return version;
  }else {
    throw "Incorrect version string found";
  }
}

function isHotfixVersion(currentVersion){
  // return /^([0-9]+)\.([0-9]+)\.([0-9]+)-beta\.([0-9]+)$/.test(currentVersion);
  return new RegExp(`^([0-9]+)\.([0-9]+)\.([0-9]+)-${HOT_FIX_TAG}\.([0-9]+)$`).test(currentVersion);
}

function isStagingVersion(currentVersion){
  // return /^([0-9]+)\.([0-9]+)\.([0-9]+)-beta\.([0-9]+)$/.test(currentVersion);
  return new RegExp(`^([0-9]+)\.([0-9]+)\.([0-9]+)-${DEFAULT_TAG}\.([0-9]+)$`).test(currentVersion);
}

function isReleasingVersion(currentVersion){
  return /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.test(currentVersion);
}


module.exports = {
  DEFAULT_TAG,
  HOT_FIX_TAG,
  getNextVersion,
  convertToHotFixVersion,
  convertToStagingVersion,
  convertToReleasingVersion,
  isHotfixVersion,
  isStagingVersion,
  isReleasingVersion,
}
