const bcrypt = require('bcrypt');

const password = 'test@123';
const hashedPassword = '$2b$10$v5lsbuAYwdZQzZ/hN.FVL.6lYJwnZLBjfD6sW66/H8GqMXFtncwGK';

bcrypt.compare(password, hashedPassword, (err, result) => {
    if (err) {
        console.error('Error comparing passwords:', err);
    } else {
        console.log('Password match:', result);
    }
});
