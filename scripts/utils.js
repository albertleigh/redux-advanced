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

function isStagingVersion(currentVersion){
  return /^([0-9]+)\.([0-9]+)\.([0-9]+)-beta\.([0-9]+)$/.test(currentVersion);
}

function isReleasingVersion(currentVersion){
  return /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.test(currentVersion);
}


module.exports = {
  getNextVersion,
  isStagingVersion,
  isReleasingVersion,
}
