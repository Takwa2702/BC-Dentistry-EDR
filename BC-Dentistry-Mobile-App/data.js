const appointmentsData = [
    {
      date: '15.05.2025',
      time: '09:30 AM',
      status: 'Upcoming',
      dr: {
        name: 'Karam Adel',
        avatar: 'https://via.placeholder.com/150',
        specialization: 'Orthodontics'
      }
    },
    {
      date: '20.05.2025',
      time: '11:00 AM',
      status: 'Upcoming',
      dr: {
        name: 'Layla Hassan',
        avatar: 'https://via.placeholder.com/150',
        specialization: 'Pediatric Dentistry'
      }
    },
    {
      date: '25.01.2025',
      time: '02:15 PM',
      status: 'Past',
      dr: {
        name: 'Yusuf Malik',
        avatar: 'https://via.placeholder.com/150',
        specialization: 'Endodontics'
      }
    },
    {
      date: '01.02.2025',
      time: '10:00 AM',
      status: 'Past',
      dr: {
        name: 'Mariam Saleh',
        avatar: 'https://via.placeholder.com/150',
        specialization: 'Periodontics'
      }
    },
    {
      date: '05.05.2025',
      time: '03:45 PM',
      status: 'Upcoming',
      dr: {
        name: 'Omar Nassar',
        avatar: 'https://via.placeholder.com/150',
        specialization: 'Prosthodontics'
      }
    }
  ];

  const dataRequests = [
    {
      type: "On-Chain",
      from: "Ahmad Ali",
      to: "Hasan Abdullah",
      status: "Pending",
      id: "5DF12940SDWAXDD437",
      about: "Medical Record Access",
      date: "2025-02-19",
      time: "10:15:32"
    },
    {
      type: "Off-Chain",
      from: "Sarah Kareem",
      to: "Omar Al-Farsi",
      status: "Granted",
      id: "3HF842LSQWEMNZZ923",
      about: "Lab Test Results",
      date: "2025-02-18",
      time: "14:22:10"
    },
    {
      type: "On-Chain",
      from: "Mohammad Yassin",
      to: "Layla Saeed",
      status: "Pending",
      id: "9KL762RPTXMGHDD128",
      about: "X-Ray Images",
      date: "2025-02-17",
      time: "09:45:21"
    },
    {
      type: "On-Chain",
      from: "Ahmad Ali",
      to: "Rami Jaber",
      status: "Granted",
      id: "7HG543ZXCWQJYTU563",
      about: "Prescription Details",
      date: "2025-02-16",
      time: "16:33:49"
    },
    {
      type: "Off-Chain",
      from: "Noor Hadi",
      to: "Maha Hussein",
      status: "Pending",
      id: "8DS431MNBQAZXTY542",
      about: "Consultation Summary",
      date: "2025-02-15",
      time: "12:10:05"
    },
    {
      type: "On-Chain",
      from: "Faisal Anwar",
      to: "Ali Rashed",
      status: "Granted",
      id: "6PL823YXWZMCQJVD741",
      about: "Surgery Report",
      date: "2025-02-14",
      time: "08:20:43"
    },
    {
      type: "Off-Chain",
      from: "Aisha Kamal",
      to: "Hana Khalid",
      status: "Pending",
      id: "4DK973QWEYUTZXCV634",
      about: "Blood Test Report",
      date: "2025-02-13",
      time: "18:55:30"
    },
    {
      type: "On-Chain",
      from: "Ahmad Ali",
      to: "Zayd Hamdan",
      status: "Granted",
      id: "1QW657ZXMCJHVDYT921",
      about: "CT Scan Report",
      date: "2025-02-12",
      time: "15:40:17"
    },
    {
      type: "Off-Chain",
      from: "Rania Fadel",
      to: "Salim Youssef",
      status: "Pending",
      id: "2XA984PLMNBQWTY563",
      about: "MRI Scan",
      date: "2025-02-11",
      time: "11:28:50"
    },
    {
      type: "On-Chain",
      from: "Ahmed Hassan",
      to: "Fatima Jaber",
      status: "Granted",
      id: "5FD321ASDZXMCQJH872",
      about: "Allergy Test Results",
      date: "2025-02-10",
      time: "20:05:14"
    }
  ];
  
  console.log(dataRequests);
  





export { appointmentsData, dataRequests }