const path = require('path');

const FORMATS = {
  dicom: { extensions: ['.dcm'], mediaTypes: ['application/dicom', 'application/octet-stream'] },
  jpeg: { extensions: ['.jpg', '.jpeg'], mediaTypes: ['image/jpeg', 'application/octet-stream'] },
  png: { extensions: ['.png'], mediaTypes: ['image/png', 'application/octet-stream'] },
};

const detectRadiographicFormat = (bytes) => {
  if (!Buffer.isBuffer(bytes)) return null;
  if (bytes.length >= 132 && bytes.subarray(128, 132).equals(Buffer.from('DICM'))) return 'dicom';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
};

const validateRadiographicFile = ({ bytes, fileName, mediaType }) => {
  const name = String(fileName || '').trim();
  const claimedMediaType = String(mediaType || 'application/octet-stream').split(';', 1)[0].trim().toLowerCase();
  const detectedFormat = detectRadiographicFormat(bytes);
  if (!detectedFormat) {
    if (path.extname(name).toLowerCase() === '.dcm' || claimedMediaType === 'application/dicom') {
      return {
        valid: false,
        code: 'CORRUPT_OR_UNREADABLE_DICOM',
        reason: 'This DICOM file is corrupt, unreadable, or does not contain a valid DICOM header',
      };
    }
    return { valid: false, reason: 'The file content is not a supported DICOM, JPEG, or PNG radiographic file' };
  }

  const rules = FORMATS[detectedFormat];
  const extension = path.extname(name).toLowerCase();
  if (!rules.extensions.includes(extension)) {
    return { valid: false, reason: `The file extension does not match the detected ${detectedFormat.toUpperCase()} content` };
  }
  if (!rules.mediaTypes.includes(claimedMediaType)) {
    return { valid: false, reason: `The declared media type does not match the detected ${detectedFormat.toUpperCase()} content` };
  }
  return {
    valid: true,
    format: detectedFormat,
    mediaType: detectedFormat === 'dicom' ? 'application/dicom' : `image/${detectedFormat}`,
  };
};

module.exports = { detectRadiographicFormat, validateRadiographicFile };
