import { View, Text } from 'react-native';
import React from 'react';
import Field from './Field';

const formatList = (items, keyName) => {
  if (!items || !Array.isArray(items) || items.length === 0) return 'Not provided';
  return items
    .map((item) => (typeof item === 'string' ? item : item?.[keyName] || item?.name || item?.drugName || JSON.stringify(item)))
    .join(', ');
};

const MedicalInfo = ({ mdata }) => {
  const bloodType = mdata?.bloodType || 'Not provided';
  const medicalHistory =
    typeof mdata?.medicalHistory === 'string'
      ? mdata.medicalHistory
      : Array.isArray(mdata?.medicalHistory)
      ? mdata.medicalHistory.join(', ')
      : 'Not provided';

  if (Array.isArray(mdata?.allergies) && mdata.allergies.length > 0) {
    const item = mdata.allergies[0];
    console.log('[MedicalInfo allergies item keys]:', typeof item === 'object' ? Object.keys(item) : typeof item);
  }

  if (Array.isArray(mdata?.medications) && mdata.medications.length > 0) {
    const item = mdata.medications[0];
    console.log('[MedicalInfo medications item keys]:', typeof item === 'object' ? Object.keys(item) : typeof item);
  }

  const allergiesText = formatList(mdata?.allergies, 'name');
  const medicationsText = formatList(mdata?.medications, 'drugName');

  const hasData =
    mdata?.bloodType ||
    mdata?.medicalHistory ||
    (Array.isArray(mdata?.allergies) && mdata.allergies.length > 0) ||
    (Array.isArray(mdata?.medications) && mdata.medications.length > 0);

  return (
    <View>
      <Text className="text-2xl font-bold bg-gray-200 rounded-lg p-3">Medical Info</Text>
      <View className="mb-4 p-2 gap-5 mt-2">
        {!hasData ? (
          <Text className="text-gray-500 italic">No medical records available.</Text>
        ) : (
          <>
            <View className="flex flex-row gap-x-8">
              <Field fieldTitle={'Blood Type'} fieldText={bloodType} />
              <Field fieldTitle={'Medical History'} fieldText={medicalHistory} />
            </View>

            <View className="flex flex-col gap-y-4 mt-2">
              <Field fieldTitle={'Allergies'} fieldText={allergiesText} />
              <Field fieldTitle={'Medications'} fieldText={medicationsText} />
            </View>
          </>
        )}
      </View>
    </View>
  );
};

export default MedicalInfo;