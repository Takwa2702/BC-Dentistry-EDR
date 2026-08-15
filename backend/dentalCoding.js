const FDI_TOOTH_CODES = new Set([
    ...[1,2,3,4].flatMap((quadrant) => Array.from({ length:8 }, (_, index) => `${quadrant}${index + 1}`)),
    ...[5,6,7,8].flatMap((quadrant) => Array.from({ length:5 }, (_, index) => `${quadrant}${index + 1}`)),
]);
const DENTAL_SURFACES = new Set(['W','M','D','O','I','B','L','P','F']);
const codingError = (code, message) => Object.assign(new Error(message), { statusCode:400, code });
const supplied = (payload, names) => names.filter((name) => payload[name] !== undefined);
const selectCodingValue = (payload, names, conflictLabel) => {
    const present = supplied(payload, names);
    if (present.length > 1) throw codingError('DENTAL_CODING_CONFLICT', `Provide only one ${conflictLabel} field: ${names.join(', ')}`);
    return present.length ? payload[present[0]] : undefined;
};

const normalizeDentalCoding = (payload) => {
    const toothValue = selectCodingValue(payload, ['teeth','tooth','site','Site'], 'tooth/site');
    const legacySingularTooth = supplied(payload, ['tooth','site','Site']).length === 1;
    const teeth = (Array.isArray(toothValue) ? toothValue : [toothValue])
        .filter((value) => value !== undefined && value !== null && value !== '').map((value) => String(value).trim());
    if (!teeth.length) throw codingError('DENTAL_TOOTH_REQUIRED', 'Select at least one tooth using two-digit FDI notation');
    if (teeth.length > 32) throw codingError('DENTAL_TOOTH_LIMIT', 'A dental chart entry may include at most 32 teeth');
    const invalidTeeth = teeth.filter((value) => value.length !== 2 || !FDI_TOOTH_CODES.has(value));
    if (invalidTeeth.length) throw codingError('INVALID_DENTAL_TOOTH', `Invalid tooth/site: ${invalidTeeth.join(', ')}. Use two-digit FDI codes 11-18, 21-28, 31-38, 41-48, or primary codes 51-55, 61-65, 71-75, 81-85`);
    const surfaceValue = selectCodingValue(payload, ['surfaces','surface','suf','Suf'], 'surface');
    const rawSurfaces = surfaceValue === undefined && legacySingularTooth ? ['W'] : surfaceValue;
    const surfaces = (Array.isArray(rawSurfaces) ? rawSurfaces : [rawSurfaces])
        .filter((value) => value !== undefined && value !== null && value !== '').map((value) => String(value).trim().toUpperCase());
    if (!surfaces.length) throw codingError('DENTAL_SURFACE_REQUIRED', 'Select at least one surface: W, M, D, O, I, B, L, P, or F');
    if (surfaces.length > DENTAL_SURFACES.size) throw codingError('DENTAL_SURFACE_LIMIT', 'A dental chart entry may include at most 9 surface codes');
    const invalidSurfaces = surfaces.filter((value) => value.length !== 1 || !DENTAL_SURFACES.has(value));
    if (invalidSurfaces.length) throw codingError('INVALID_DENTAL_SURFACE', `Invalid surface: ${invalidSurfaces.join(', ')}. Allowed values are W, M, D, O, I, B, L, P, and F`);
    if (surfaces.includes('W') && surfaces.length > 1) throw codingError('DENTAL_SURFACE_CONFLICT', 'Whole tooth (W) cannot be combined with individual surfaces');
    const surfaceOrder = [...DENTAL_SURFACES];
    return { ...payload, teeth:[...new Set(teeth)].sort((left,right) => Number(left) - Number(right)),
        surfaces:[...new Set(surfaces)].sort((left,right) => surfaceOrder.indexOf(left) - surfaceOrder.indexOf(right)),
        tooth:undefined, site:undefined, Site:undefined, surface:undefined, suf:undefined, Suf:undefined };
};

module.exports = { FDI_TOOTH_CODES, DENTAL_SURFACES, normalizeDentalCoding };
