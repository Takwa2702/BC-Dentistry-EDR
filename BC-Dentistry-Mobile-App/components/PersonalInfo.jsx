import { View, Text } from 'react-native'
import { Field } from './index'

const personalFields = [
  ['emiratesID', 'Emirates ID'],
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['dateOfBirth', 'Date of birth'],
  ['address', 'Address'],
  ['contactNumber', 'Mobile phone'],
  ['email', 'Email address'],
  ['gender', 'Gender'],
]

const PersonalInfo = ({ pdata = [] }) => {
  const patient = pdata[0]
  return (
    <View className="flex flex-col gap-2" accessible accessibilityLabel="Personal information">
      <Text accessibilityRole="header" className="text-2xl font-bold bg-gray-200 rounded-lg p-3">Personal information</Text>
      <View className="mb-4 p-2 gap-5">
        {!patient ? (
          <Text accessibilityRole="alert">Patient information is unavailable.</Text>
        ) : personalFields.map(([key, label]) => (
          <Field key={key} fieldTitle={label} fieldText={patient[key] == null || patient[key] === '' ? 'Not provided' : String(patient[key])} />
        ))}
      </View>
    </View>
  )
}

export default PersonalInfo
