import { View, Text } from "react-native"


const DataRequestElement = ({containerClasses, header, headerClasses, details, detailsClasses}) => {
    return (
        <View className={containerClasses}>
            <Text className={headerClasses}>{header}</Text>
            <Text className={detailsClasses}>{details}</Text>
        </View>
    )
}


export default DataRequestElement