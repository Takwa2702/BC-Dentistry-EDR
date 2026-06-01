class Doctor {
    constructor(doctorID, password, firstName, lastName, phoneNumber, emailAddress, enrolmentDate) {
        this.doctorID = doctorID;
        this.password = password;
        this.firstName = firstName;
        this.lastName = lastName;
        this.phoneNumber = phoneNumber;
        this.emailAddress = emailAddress;
        this.enrolmentDate = enrolmentDate;
        this.isLoggedIn = false; // Track login status
    }

    login(username, password) {
       
        if (username === this.doctorID && password === this.password) {
            this.isLoggedIn = true;
            console.log(`${this.firstName} ${this.lastName} logged in.`);
        } else {
            console.log(`Login failed. Invalid username or password.`);
        }
    }

    logout() {
     
        if (this.isLoggedIn) {
            this.isLoggedIn = false;
            console.log(`${this.firstName} ${this.lastName} logged out.`);
        } else {
            console.log(`Logout failed. User is not logged in.`);
        }
    }

    managePatient() {
 
        if (this.isLoggedIn) {
            console.log(`Managing patient records for ${this.firstName} ${this.lastName}.`);
        } else {
            console.log(`Action failed. User is not logged in.`);
        }
    }

    addDiagnosis() {
        
        if (this.isLoggedIn) {
            console.log(`Adding diagnosis for ${this.firstName} ${this.lastName}.`);
        } else {
            console.log(`Action failed. User is not logged in.`);
        }
    }


}


const doctor1 = new Doctor("D123", "doctorpass", "John", "Doe", "123456789", "john.doe@email.com", new Date());
doctor1.login("D123", "doctorpass"); // Successful login
doctor1.managePatient(); // Successful action while logged in
doctor1.addDiagnosis(); // Successful action while logged in
doctor1.logout(); // Successful logout
doctor1.managePatient(); // Failed action after logout
