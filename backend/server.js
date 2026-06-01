const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const SECRET_KEY = '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1d0c9b8a7f6e5d4c3b2a1d0c9b8a'; // Replace with an environment variable for production

// // Set CORS options to allow requests from your frontend
// const corsOptions = {
//     origin: 'http://localhost:5174',  // Only allow requests from this origin
//     optionsSuccessStatus: 200 // Legacy browsers support
// };
const corsOptions = {
    origin: '*',  // Allow requests from any domain
    optionsSuccessStatus: 200
};


app.use(cors(corsOptions));
app.use(express.json()); // Parse JSON bodies

// Set up MySQL connection with your database details
const db = mysql.createConnection({
    host: "mysql-server",//"172.17.0.2", // Replace with your database host
    user: 'root', // Replace with your MySQL username
    password: 'OpenUAE@123', // Replace with your MySQL password
    database: 'mydatabase' // Replace with your database name
});

// Log connection success or errors
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database');
});


app.use((req, res, next) => {
    console.log('Received request:', req.method, req.url);  // Logs every incoming request
    next();
});


// Home route for testing
app.get('/', (req, res) => {
    return res.json("from backend side");
});



app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Input check
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    console.log('🔐 Login attempt:', email);

    const sql = `
        SELECT 
            User.ID, User.First_Name, User.Last_Name, User.Email, User.Password, 
            UserRole.Name AS Role_Name,
            COALESCE(Admin.Organization_ID, NULL) AS Organization_ID,
            COALESCE(Doctor.Works_At, NULL) AS WorksAt,
            COALESCE(Doctor.Specialty, NULL) AS Specialty,
            COALESCE(Doctor.Blockchain_ID, NULL) AS BlockchainID
        FROM User 
        INNER JOIN UserRole ON User.Role_ID = UserRole.Role_ID
        LEFT JOIN Admin ON User.ID = Admin.User_ID
        LEFT JOIN Doctor ON User.ID = Doctor.ID
        WHERE User.Email = ?
    `;

    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error('❌ DB error:', err);
            return res.status(500).json({ error: 'Database error during login' });
        }

        if (results.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.Password);

        if (!match) {
            console.log('❌ Password mismatch for:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        db.query("UPDATE User SET Last_Login_Date = NOW() WHERE ID = ?", [user.ID], (updateErr) => {
            if (updateErr) console.warn('⚠️ Failed to update last login date:', updateErr);
        });

        // JWT payload
        const tokenPayload = {
            id: user.ID,
            role: user.Role_Name,
            ...(user.Role_Name === "Doctor" && { blockchainID: user.BlockchainID })
        };

        const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '2h' });

        // User data to return
        const userData = {
            id: user.ID,
            name: `${user.First_Name} ${user.Last_Name}`,
            email: user.Email,
            role: user.Role_Name,
            organizationId: user.Organization_ID || null,
            worksAt: user.WorksAt || null,
            specialty: user.Specialty || null,
            blockchainID: user.BlockchainID || null
        };

        res.status(200).json({ token, user: userData });
    });
});


// Login
// app.post('/login', (req, res) => {
//     const { username, password } = req.body;

//     console.log('Login attempt:', username);

//     // Fetch user details along with role and organization ID (for admins only)
//     const sql = `
//         SELECT User.ID, User.First_Name, User.Last_Name, User.Email, User.Password, 
//                UserRole.Name AS Role_Name, 
//                COALESCE(Admin.Organization_ID, NULL) AS Organization_ID
//         FROM User 
//         INNER JOIN UserRole ON User.Role_ID = UserRole.Role_ID
//         LEFT JOIN Admin ON User.ID = Admin.User_ID  -- Join Admin table to get Organization_ID
//         WHERE User.Email = ?
//     `;

//     db.query(sql, [username], async (err, results) => {
//         if (err) {
//             console.error('Database error:', err);
//             return res.status(500).json({ error: 'Database error during login' });
//         }

//         if (results.length === 0) {
//             console.log('User not found:', username);
//             return res.status(401).json({ error: 'Invalid username or password' });
//         }

//         const user = results[0];

//         const passwordMatch = await bcrypt.compare(password, user.Password);

//         if (!passwordMatch) {
//             return res.status(401).json({ error: 'Invalid username or password' });
//         }

//         // Update Last_Login_Date
//         const updateLoginDateSQL = "UPDATE User SET Last_Login_Date = NOW() WHERE ID = ?";
//         db.query(updateLoginDateSQL, [user.ID], (updateErr) => {
//             if (updateErr) {
//                 console.error('Error updating Last_Login_Date:', updateErr);
//                 return res.status(500).json({ error: 'Error updating Last Login Date' });
//             }
//         });

//         const token = jwt.sign({ id: user.ID, role: user.Role_Name }, SECRET_KEY, { expiresIn: '1h' });

//         // Send user details including organization ID for admins
//         res.json({ 
//             token, 
//             user: { 
//                 id: user.ID, 
//                 name: `${user.First_Name} ${user.Last_Name}`, 
//                 role: user.Role_Name,
//                 organizationId: user.Organization_ID || null // Include organization ID only for admins
//             } 
//         });
//     });
// });


// app.post('/login', async (req, res) => {
//     const { email, password } = req.body;

//     console.log('Login attempt:', req.body);

//     const sql = `
//         SELECT User.ID, User.First_Name, User.Last_Name, User.Email, User.Password, 
//                UserRole.Name AS Role_Name, 
//                COALESCE(Admin.Organization_ID, NULL) AS Organization_ID,
//                COALESCE(Doctor.Works_At, NULL) AS WorksAt,
//                COALESCE(Doctor.Specialty, NULL) AS Specialty,
//                COALESCE(Doctor.Blockchain_ID, NULL) AS BlockchainID
//         FROM User 
//         INNER JOIN UserRole ON User.Role_ID = UserRole.Role_ID
//         LEFT JOIN Admin ON User.ID = Admin.User_ID  
//         LEFT JOIN Doctor ON User.ID = Doctor.ID  
//         WHERE User.Email = ?
//     `;

//     db.query(sql, [email], async (err, results) => {
//         if (err) {
//             console.error('Database error:', err);
//             return res.status(500).json({ error: 'Database error during login' });
//         }

//         if (results.length === 0) {
//             console.log('User not found:', email);
//             return res.status(401).json({ error: 'Invalid email' });
//         }

//         const user = results[0];

//         const passwordMatch = await bcrypt.compare(password, user.Password);
//         console.log('✅ Retrieved user:', user.Email);
//         console.log('🔐 Stored hash:', user.Password);
//         console.log('🔑 Input password:', password);
//         console.log('🔑 Password Match:', passwordMatch);

//         if (!passwordMatch) {
//             return res.status(401).json({ error: 'Invalid password' });
//         }

//         // Update Last_Login_Date
//         const updateLoginDateSQL = "UPDATE User SET Last_Login_Date = NOW() WHERE ID = ?";
//         db.query(updateLoginDateSQL, [user.ID], (updateErr) => {
//             if (updateErr) {
//                 console.error('Error updating Last_Login_Date:', updateErr);
//                 return res.status(500).json({ error: 'Error updating Last Login Date' });
//             }
//         });

//         // Construct user object based on role
//         const userData = {
//             id: user.ID,
//             name: `${user.First_Name} ${user.Last_Name}`,
//             role: user.Role_Name,
//             organizationId: user.Organization_ID || null, // Only for Admins
//             worksAt: user.WorksAt || null, // Only for Doctors
//             specialty: user.Specialty || null, // Only for Doctors
//             blockchainID: user.BlockchainID || null // Only for Doctors
//         };

//         // Create JWT token including blockchainID (for doctors)
//         const tokenPayload = { 
//             id: user.ID, 
//             role: user.Role_Name, 
//             blockchainID: user.BlockchainID || null 
//         };
//         const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '1h' });

//         // Return token + user details
//         res.json({ token, user: userData });
//     });
// });




// Middleware to authenticate token



const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Protected route example
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Access granted', user: req.user });
});


// Sync On-Chain Patients to Off-Chain MySQL
// Route to sync on-chain patients into MySQL Patient and User tables
app.post('/syncOnChainPatients', async (req, res) => {
    try {
        const response = await fetch('http://localhost:8081/getAllPatients');
        const onChainPatients = await response.json();

        const insertPatient = (patient) => {
            return new Promise((resolve, reject) => {
                const selectSQL = 'SELECT * FROM Patient WHERE Emirates_ID = ?';
                db.query(selectSQL, [patient.emiratesID], async (err, results) => {
                    if (err) return reject(err);

                    if (results.length > 0) return resolve('Patient already exists');

                    const insertUserSQL = `INSERT INTO User (First_Name, Last_Name, Email, Contact_Number, Password, Role_ID, Created_Date, IsActive) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)`;
                    const hashedPassword = await bcrypt.hash('DefaultPassword123!', 10); // Default password

                    db.query(insertUserSQL, [
                        patient.firstName,
                        patient.lastName,
                        patient.email,
                        patient.contactNumber,
                        hashedPassword,
                        4  // Role_ID for Patient
                    ], (err, userResult) => {
                        if (err) return reject(err);
                        const userId = userResult.insertId;

                        const insertPatientSQL = `INSERT INTO Patient (ID, Date_of_Birth, Gender, Emirates_ID) VALUES (?, ?, ?, ?)`;
                        db.query(insertPatientSQL, [
                            userId,
                            patient.dateOfBirth,
                            patient.gender,
                            patient.emiratesID
                        ], (err) => {
                            if (err) return reject(err);
                            resolve(`Inserted patient ${patient.firstName} ${patient.lastName}`);
                        });
                    });
                });
            });
        };

        const insertResults = [];
        for (const patient of onChainPatients) {
            try {
                const result = await insertPatient(patient);
                insertResults.push(result);
            } catch (err) {
                insertResults.push(`Error inserting ${patient.patientID}: ${err.message}`);
            }
        }

        res.json({ message: 'Sync complete', details: insertResults });
    } catch (error) {
        console.error('Error syncing patients:', error);
        res.status(500).json({ error: 'Failed to sync patients' });
    }
});


// Authentication APIs
// Register a new user
app.post('/register', async (req, res) => {
    console.log("Received Data:", req.body); // Debugging Line
    
    const { firstName, lastName, username, contactNumber, password, organizationId } = req.body;
    const roleId = 2; // Hardcoded for Admin role (Only Admins can register)

    // Validate required fields
    if (!firstName || !lastName || !username || !contactNumber || !password || !organizationId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Check if the user already exists
        const checkUserSQL = "SELECT * FROM User WHERE Email = ?";
        db.query(checkUserSQL, [username], async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error during user check' });
            }
            if (results.length > 0) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert into User table (Only for Admin)
            const insertUserSQL = `
                INSERT INTO User 
                (First_Name, Last_Name, Email, Contact_Number, Password, Role_ID, Created_Date, IsActive) 
                VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)
            `;
            db.query(insertUserSQL, [firstName, lastName, username, contactNumber, hashedPassword, roleId], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Database error during user registration' });
                }

                const userId = result.insertId; // Get newly inserted Admin's User ID

                // Insert into Admin table
                const insertAdminSQL = `INSERT INTO Admin (User_ID, Organization_ID) VALUES (?, ?)`;
                db.query(insertAdminSQL, [userId, organizationId], (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Database error during admin registration' });
                    }
                    return res.json({ message: 'Admin registered successfully' });
                });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error processing registration' });
    }
});

app.post('/registerDoctor', async (req, res) => {
    const { firstName, lastName, username, contactNumber, password, worksAt, speciality, doctorID } = req.body;
    const roleId = 3; // Role ID for Doctor

    // Validate required fields
    if (!firstName || !lastName || !username || !contactNumber || !password || !worksAt || !speciality) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Check if the doctor already exists in the User table
        const checkUserSQL = "SELECT * FROM User WHERE Email = ?";
        db.query(checkUserSQL, [username], async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error during user check' });
            }
            if (results.length > 0) {
                return res.status(400).json({ error: 'Doctor already exists' });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert into User table
            const insertUserSQL = `
                INSERT INTO User 
                (First_Name, Last_Name, Email, Contact_Number, Password, Role_ID, Created_Date, IsActive) 
                VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)
            `;
            db.query(insertUserSQL, [firstName, lastName, username, contactNumber, hashedPassword, roleId], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Database error during user registration' });
                }

                const userId = result.insertId; // Get the new doctor’s MySQL ID

                // If `doctorID` is provided, use it; otherwise, generate it as `Doctor<ID>`
                const blockchainDoctorID = doctorID || `Doctor${userId}`;

                // Insert into Doctor table with Blockchain ID
                const insertDoctorSQL = `INSERT INTO Doctor (ID, Works_At, Specialty, Blockchain_ID) VALUES (?, ?, ?, ?)`;
                db.query(insertDoctorSQL, [userId, worksAt, speciality, blockchainDoctorID], async (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Database error during doctor registration' });
                    }

                    return res.json({ 
                        message: 'Doctor registered successfully in MySQL', 
                        doctorID: blockchainDoctorID 
                    });
                });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error processing doctor registration' });
    }
});

// Route to fetch Patients
app.get('/Patient', (req, res) => {
    const sql = "SELECT * FROM Patient";
    db.query(sql, (err, data) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }
        return res.json(data);
    });
});

// Route to fetch Appointments
app.get('/Appointment', (req, res) => {
    const sql = "SELECT * FROM Appointment";
    db.query(sql, (err, data) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }
        return res.json(data);
    });
});

// Route to fetch Doctors
app.get('/Doctor', (req, res) => {
    const sql = "SELECT * FROM Doctor";
    db.query(sql, (err, data) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }
        return res.json(data);
    });
});

// Route to fetch Lab Results
app.get('/Lab_Results', (req, res) => {
    // Sample test data
    const testData = [
        {
            ID: 1,
            T_Name: 'Hemoglobin Test',
            Order_ID: 1001,
            Case_ID: 501,
            Site_ID: 101,
            Discipline: 'Hematology',
            Status: 'Completed',
            Created_Date: '2024-08-01'
        },
        {
            ID: 2,
            T_Name: 'Lipid Panel',
            Order_ID: 1002,
            Case_ID: 502,
            Site_ID: 102,
            Discipline: 'Cardiology',
            Status: 'In Progress',
            Created_Date: '2024-09-15'
        },
        {
            ID: 3,
            T_Name: 'Complete Blood Count',
            Order_ID: 1003,
            Case_ID: 503,
            Site_ID: 103,
            Discipline: 'Hematology',
            Status: 'Completed',
            Created_Date: '2024-07-25'
        },
        {
            ID: 4,
            T_Name: 'Kidney Function Test',
            Order_ID: 1004,
            Case_ID: 504,
            Site_ID: 104,
            Discipline: 'Nephrology',
            Status: 'Pending',
            Created_Date: '2024-10-01'
        },
        {
            ID: 5,
            T_Name: 'Liver Function Test',
            Order_ID: 1005,
            Case_ID: 505,
            Site_ID: 105,
            Discipline: 'Gastroenterology',
            Status: 'Completed',
            Created_Date: '2024-06-10'
        },
        {
            ID: 6,
            T_Name: 'Thyroid Function Test',
            Order_ID: 1006,
            Case_ID: 506,
            Site_ID: 106,
            Discipline: 'Endocrinology',
            Status: 'Pending',
            Created_Date: '2024-07-22'
        }
    ];

    // Log the test data
    console.log('Lab Results fetched (test data):', testData);
    
    // Send the test data as a response
    res.json(testData);
});

// Route to fetch all users (including encrypted passwords)
app.get('/users', (req, res) => {
    const sql = `
        SELECT 
            ID, First_Name, Last_Name, Email, Contact_Number, Password, Role_ID, Created_Date, IsActive, Last_Login_Date 
        FROM User
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }
        return res.json(results);
    });
});

// Start the server
// app.listen(8080, () => {
//     console.log("listening on port 8080");
// }); 
app.listen(8080, '0.0.0.0', () => {
    console.log("listening on port 8080");
});
