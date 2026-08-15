import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/Input';
import LoginSignUpBtn from '../components/LoginSignUpBtn';
import axios from 'axios';
import { databaseUrl } from '../config/api.js';
import { useRole } from '../Context/RoleContext.jsx';
import QRCode from 'qrcode';

const LoginSection = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [mfa, setMfa] = useState(null);
    const [code, setCode] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState(null);
    const [enrollmentQr, setEnrollmentQr] = useState('');
    const [qrError, setQrError] = useState('');
    const navigate = useNavigate();
    const { setUserRole } = useRole();

    useEffect(() => {
        const uri = mfa?.enrollmentRequired ? mfa.setup?.provisioningUri : '';
        if (!uri) { setEnrollmentQr(''); setQrError(''); return; }
        let active = true;
        QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2, width: 240 })
            .then((dataUrl) => { if (active) { setEnrollmentQr(dataUrl); setQrError(''); } })
            .catch(() => { if (active) { setEnrollmentQr(''); setQrError('QR code unavailable. Use the manual setup key below.'); } });
        return () => { active = false; };
    }, [mfa]);

    const handleLogin = async (email, password) => {
        // console.log('email:', email); // Add this
        // console.log('Password:', password); // Add this
    
        try {
            const response = await axios.post(databaseUrl('/login'), {
                email,
                password,
                clientType: 'web',
                deviceLabel: navigator.userAgent,
            }, { withCredentials: true });
    
            if (response.data.mfaRequired) {
                setMfa(response.data);
                setError('');
                return;
            }
            completeLogin(response.data.user);
        } catch (requestError) {
            setError(requestError.response?.data?.error?.message || requestError.response?.data?.error || 'Invalid email or password');
        }
    };

    const completeLogin = (user) => {
            sessionStorage.setItem('user', JSON.stringify(user));
            window.dispatchEvent(new Event('edr-session-changed'));
            setUserRole(user.role?.toLowerCase() || null);
    
            const role = user.role?.toLowerCase();
            const destination = user.mustChangePassword ? '/change-password' : role === 'system' ? '/clinics' : role === 'patient' ? '/my-record' : ['admin', 'doctor'].includes(role) ? '/dashboard' : '/unauthorized';
            navigate(destination, { replace: true });
    };

    const verifyMfa = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post(databaseUrl('/auth/mfa/verify'), { challenge: mfa.challenge, code }, { withCredentials: true });
            if (response.data.recoveryCodes?.length) {
                setRecoveryCodes(response.data.recoveryCodes);
                setMfa({ ...mfa, completedUser: response.data.user });
                return;
            }
            completeLogin(response.data.user);
        } catch (requestError) {
            setError(requestError.response?.data?.error?.message || 'Invalid or expired authentication code');
        }
    };

    if (recoveryCodes) return <div className='loginTh2 h-full w-full flex flex-col justify-center px-4 sm:px-8 md:px-16'>
        <div className="rounded-lg bg-white p-6 w-full md:w-[36em] z-40">
            <h2 className="text-3xl font-semibold">Save your recovery codes</h2>
            <p className="mt-3">Store these one-time codes securely. They will not be shown again.</p>
            <ul className="mt-4 grid grid-cols-2 gap-2 font-mono" aria-label="MFA recovery codes">{recoveryCodes.map((item)=><li key={item}>{item}</li>)}</ul>
            <button type="button" className="mt-6 rounded bg-blue-700 px-5 py-3 text-white" onClick={()=>completeLogin(mfa.completedUser)}>I have saved these codes</button>
        </div>
    </div>;

    if (mfa) return <div className='loginTh2 h-full w-full flex flex-col justify-center px-4 sm:px-8 md:px-16'>
        <div className="rounded-lg bg-white p-6 w-full md:w-[36em] z-40">
            <h2 className="text-3xl font-semibold">Two-step verification</h2>
            {mfa.enrollmentRequired && <div className="mt-4">
                <p>In Google Authenticator, tap Add a code, choose Scan a QR code, then scan this image.</p>
                {enrollmentQr && <img className="mx-auto mt-4 h-60 w-60 rounded border bg-white p-2" src={enrollmentQr} alt="QR code for adding this EDR account to an authenticator app" />}
                {qrError && <p role="alert" className="mt-3 text-amber-700">{qrError}</p>}
                <p className="mt-3">Manual setup key:</p><code className="block break-all rounded bg-gray-100 p-3">{mfa.setup.secret}</code>
            </div>}
            {!mfa.enrollmentRequired && <p className="mt-3">Enter the six-digit code from your authenticator app, or a recovery code.</p>}
            {error && <p role="alert" className="mt-3 text-red-600">{error}</p>}
            <form onSubmit={verifyMfa} className="mt-4">
                <label htmlFor="mfa-code" className="block text-sm font-medium">Authentication or recovery code</label>
                <input id="mfa-code" required autoComplete="one-time-code" inputMode={mfa.enrollmentRequired ? 'numeric' : 'text'} value={code} onChange={(event)=>setCode(event.target.value)} className="mt-1 w-full rounded border p-3" />
                <button className="mt-4 rounded bg-blue-700 px-5 py-3 text-white">Verify and sign in</button>
            </form>
        </div>
    </div>;


    return (
        <div className='loginTh2 h-full w-full md:w-auto flex flex-col justify-center px-4 sm:px-8 md:px-16 top-0 right-0'>
            <div className="rounded-lg p-6 w-full md:w-[36em] z-40 ">
                <form id="login-form" onSubmit={(event) => { event.preventDefault(); handleLogin(email, password); }}>
                    <div className='flex justify-between items-center'>
                        <h2 className="text-4xl font-semibold text-left mb-4">Welcome Back !</h2>
                    </div>
                    {error && <p className="text-red-500">{error}</p>}
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <Input
                            Id={"email"}
                            Type={'email'}
                            isRequired={true}
                            Classes={'w-full'}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                    </div>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>

                        <Input
                            Type={'password'}
                            Id={"password"}
                            isRequired={true}
                            Classes={'w-full'}
                            onChange={(e) => setPassword(e.target.value)}
                        /> 

                    </div>
                        {/* <LoginSignUpBtn text={"Login"} 
                        email={email}
                        password={password}
                        onLogin={handleLogin}
                        /> */}
                        <LoginSignUpBtn text="Login" />


         
                </form>
            </div>
        </div>

    );
};

export default LoginSection;
