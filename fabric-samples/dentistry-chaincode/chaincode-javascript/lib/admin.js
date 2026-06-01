


class Admin {
    constructor(adminID, password, firstName, lastName, phoneNumber, emailAddress, enrolmentDate) {
        this.adminID = adminID;
        this.password = password;
        this.firstName = firstName;
        this.lastName = lastName;
        this.phoneNumber = phoneNumber;
        this.emailAddress = emailAddress;
        this.enrolmentDate = enrolmentDate;
    }

    
    getAllMedicalRecords() {
        // Implement getAllMedicalRecords logic
        console.log(`Fetching all medical records.`);
    }

    getPermissions() {
        // Implement getPermissions logic for the datasharing
        console.log(`Fetching permissions for ${this.firstName} ${this.lastName}.`);
    }
}

// Example usage:
const admin1 = new Admin("A001", "adminpass", "Admin", "One", "555888999", "admin@email.com", new Date());
admin1.listAllMedicalRecords();
admin1.addPatient();
admin1.getAllMedicalRecords();
admin1.getPermissions();
