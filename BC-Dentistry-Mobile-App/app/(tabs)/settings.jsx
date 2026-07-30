import { SafeAreaView, View, Text } from 'react-native'
import { Brief, Information, PageHeader } from '../../components'
import { useUser } from '../../Context/UserContext'

const Settings = () => {
  const { user } = useUser()

  return (
    <SafeAreaView accessibilityLabel="Patient account information">
      <View className="flex flex-col items-center">
        <PageHeader headerText="Account information" />
        <View className="bg-white-off p-6 flex flex-col gap-y-8">
          {!user ? (
            <Text accessibilityRole="alert">Your session has expired. Please sign in again.</Text>
          ) : (
            <>
              <Brief
                name={`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Patient'}
                id={user.emiratesID || user.blockchainID || 'Not available'}
              />
              <Information data={user} />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

export default Settings
