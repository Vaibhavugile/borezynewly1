import React, { useState, useEffect } from 'react';
import { db } from '../../../firebaseConfig';
import { collection, doc, addDoc, getDoc, query, getDocs, orderBy, writeBatch, where, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL, listAll } from "firebase/storage";
import { Await, useNavigate } from 'react-router-dom';
import UserHeader from '../../UserDashboard/UserHeader';
import UserSidebar from '../../UserDashboard/UserSidebar';
import { useUser } from '../../Auth/UserContext';
import { toast, ToastContainer } from 'react-toastify'; // Import react-toastify
import 'react-toastify/dist/ReactToastify.css'; // Import CSS for react-toastify
import { FaSearch, FaDownload, FaUpload, FaPlus, FaEdit, FaTrash, FaCopy } from 'react-icons/fa';
import "../Availability/Booking.css"
function Booking() {
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  const [productCode, setProductCode] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isAvailabilityFormVisible, setIsAvailabilityFormVisible] = useState(true);
  const [isAvailability1FormVisible, setIsAvailability1FormVisible] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [isPaymentFormVisible, setIsPaymentFormVisible] = useState(false);
  const [subUsers, setSubUsers] = useState([]);
  const [selectedSubUser, setSelectedSubUser] = useState('');
  const [availableCredit, setAvailableCredit] = useState(0);  // Add this line
  const [appliedCredit, setAppliedCredit] = useState(0);
  const [creditNoteId, setCreditNoteId] = useState(null);
  const [visibleForm, setVisibleForm] = useState(''); // Track visible form by its id
  const [userDetails, setUserDetails] = useState({
    name: '', email: '', contact: '', alternativecontactno: '', identityproof: '', identitynumber: '', source: '', customerby: '', receiptby: '', stage: 'Booking', alterations: '', grandTotalRent: '', grandTotalDeposit: '', discountOnRent: '',
    discountOnDeposit: '', finalrent: '', finaldeposite: '', totalamounttobepaid: '', amountpaid: '', paymentstatus: '', firstpaymentmode: '', firstpaymentdtails: '', secondpaymentmode: '', secondpaymentdetails: '', specialnote: '',
  });


  const [receipt, setReceipt] = useState(null); // Store receipt details
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false); // Track if payment is confirmed
  const [productImageUrl, setProductImageUrl] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [availableQuantity, setAvailableQuantity] = useState(null);
  const [deposit, setDeposit] = useState(0); // Add a state for deposit
  const [price, setPrice] = useState(0); // Add a state for price
  const [numDays, setNumDays] = useState(0);
  const [loggedInBranchCode, setLoggedInBranchCode] = useState('');
  const { userData } = useUser();
  const [discount, setDiscount] = useState(0); // State for the discount input
  // State for the updated grand total
  const [productSuggestions, setProductSuggestions] = useState([]);

  // Handle discount change
  const handleDiscountChange = (e) => {
    const discountAmount = parseFloat(e.target.value) || 0;
    setDiscount(discountAmount);
  };

  // Recalculate the discounted grand total whenever the discount or receipt changes



  // Example: After user login or fetching user data


  const getFixedTime = (date) => {
    return date.toISOString().split("T")[0] + "T01:00"; // Set default time to 3:00 PM
  };
  const getFixedTime1 = (date) => {
    return date.toISOString().split("T")[0] + "T23:00"; // Set default time to 3:00 PM
  };


  // Number of days between pickup and return


  const getInitialProducts = () => {
    const pickupDate = new Date();
    const pickupDateStr = getFixedTime(pickupDate); // today at 15:00

    const returnDate = new Date(pickupDate);
    returnDate.setDate(returnDate.getDate() + 2); // add 2 days
    const returnDateStr = getFixedTime1(returnDate); // 2 days later at 14:00

    return [
      {
        pickupDate: pickupDateStr,
        returnDate: returnDateStr,
        productCode: '',
        quantity: '',
        availableQuantity: null,
        errorMessage: '',
        price: '',
        deposit: '',
        productName: '',
      },
    ];
  };
  const [products, setProducts] = useState(getInitialProducts);

  const navigate = useNavigate();
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };


  const [firstProductDates, setFirstProductDates] = useState({
    pickupDate: products.pickupDate,
    returnDate: products.returnDate,
  });

  const handleProductChange = async (index, event) => {
    const { name, value } = event.target;
    const newProducts = [...products];
    newProducts[index][name] = value;

    if (name === 'productCode' && value.trim()) {
      // Fetch product suggestions from Firestore based on input
      fetchProductSuggestions(value);
    } else {
      setProductSuggestions([]); // Clear suggestions if input is empty
    }

    setProducts(newProducts);
  };

  // Fetch product suggestions based on the entered product code
  const fetchProductSuggestions = async (searchTerm) => {
    try {
      setLoggedInBranchCode(userData.branchCode);

      // Query the new Firestore structure for products under the respective branchCode
      const productsRef = collection(db, `products/${loggedInBranchCode}/products`);
      const q = query(
        productsRef,
        where('productCode', '>=', searchTerm), // Assuming you want to search for product codes starting with searchTerm
        where('productCode', '<=', searchTerm + '\uf8ff') // For prefix-based search
      );

      const querySnapshot = await getDocs(q);

      const suggestions = [];
      querySnapshot.forEach((doc) => {
        const productData = doc.data();
        if (productData.productCode && productData.productCode.includes(searchTerm)) {
          suggestions.push({
            productCode: productData.productCode,
            productName: productData.productName || 'N/A',
          });
        }
      });

      setProductSuggestions(suggestions);

      if (suggestions.length === 0) {
        console.log('No products found for the logged-in branch');
      }
    } catch (error) {
      console.error('Error fetching product suggestions:', error);
    }
  };

  // Fetch product details when a product code is entered or selected
  const fetchProductDetails = async (productCode, index) => {
    try {
      setLoggedInBranchCode(userData.branchCode);

      // Query the new Firestore structure for the product under the respective branchCode
      const productRef = doc(db, `products/${loggedInBranchCode}/products`, productCode);
      const productDoc = await getDoc(productRef);

      if (productDoc.exists()) {
        const productData = productDoc.data();
        const productBranchCode = productData.branchCode || '';

        if (productBranchCode === loggedInBranchCode) {
          const imagePath = productData.imageUrls ? productData.imageUrls[0] : null;
          const price = productData.price || 'N/A';
          const priceType = productData.priceType || 'daily';
          const deposit = productData.deposit || 'N/A';
          const totalQuantity = productData.quantity || 0;
          const minimumRentalPeriod = productData.minimumRentalPeriod || 1;
          const extraRent = productData.extraRent || 0;
          const productName = productData.productName || 'N/A';

          let imageUrl = null;
          if (imagePath) {
            const storage = getStorage();
            const imageRef = ref(storage, imagePath);
            imageUrl = await getDownloadURL(imageRef);
          } else {
            imageUrl = 'path/to/placeholder-image.jpg';
          }

          // Prevent unnecessary state updates
          setProducts((prevProducts) => {
            const newProducts = [...prevProducts];
            if (
              newProducts[index].price !== price ||
              newProducts[index].imageUrl !== imageUrl ||
              newProducts[index].deposit !== deposit
            ) {
              newProducts[index] = {
                ...newProducts[index],
                imageUrl,
                price,
                deposit,
                totalQuantity,
                priceType,
                minimumRentalPeriod,
                extraRent,
                productName,
              };
            }
            return newProducts;
          });
        } else {
          toast.error('Product does not belong to this branch.');
        }
      } else {
        console.error('Product not found in Firestore.');
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
    }
  };

  // Handle selection of a product from suggestions
  const handleSuggestionClick = (index, suggestion) => {
    const newProducts = [...products];
    newProducts[index].productCode = suggestion.productCode;
    setProducts(newProducts);
    setProductSuggestions([]); // Clear suggestions

    // Fetch product details for the selected product code
    fetchProductDetails(suggestion.productCode, index);
  };

  // Function to fetch product image, price, and deposit based on productCode

  const generateReceiptNumber = async (branchCode) => {
    // New path inside products/{branchCode}/branchCounters/receipt
    const receiptCounterRef = doc(db, `products/${branchCode}/branchCounters/receipt`);

    // Fetch the current receipt number counter
    const receiptCounterDoc = await getDoc(receiptCounterRef);

    let receiptNumber = 1; // Default to 1 if no counter exists

    if (receiptCounterDoc.exists()) {
      const data = receiptCounterDoc.data();
      receiptNumber = data.currentValue + 1; // Increment the counter
    }

    // Update the counter in Firestore
    await setDoc(receiptCounterRef, { currentValue: receiptNumber });

    // Format the receipt number
    return `${branchCode}-REC-${String(receiptNumber).padStart(6, '0')}`;
  };






  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prevDetails) => ({
      ...prevDetails,
      [name]: value,
    }));
    if (name === 'contact') {
      setAvailableCredit(0);
      setAppliedCredit(0);
      setCreditNoteId(null);
      fetchCreditNote(value);
    }
  };
  const fetchCreditNote = async (contactNumber) => {
    if (userData?.branchCode && contactNumber) {
      const creditNotesRef = collection(db, `products/${userData.branchCode}/creditNotes`);
      const q = query(creditNotesRef, where('mobileNumber', '==', contactNumber), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const creditNoteData = querySnapshot.docs[0].data();
        setAvailableCredit(creditNoteData.Balance);
        setCreditNoteId(querySnapshot.docs[0].id);
        toast.info(`Available credit: ₹${creditNoteData.Balance}`);
      } else {
        setAvailableCredit(0);
        setCreditNoteId(null);
      }
    }
  };

  const handleFirstProductDateChange = (e, field, index) => {
    const newProducts = [...products];
    let value = e.target.value;

    const selectedDate = new Date(value);
    const today = new Date();

    if (field === "pickupDate") {
      if (selectedDate < today) {
        toast.warn("Pickup date cannot be in the past.");
        return;
      }

      // Only auto-update returnDate if it’s the first product
     if (index === 0) {
  const returnDate = new Date(newProducts[index].returnDate);
  const minReturnDate = new Date(selectedDate);
  minReturnDate.setDate(minReturnDate.getDate() + 2);
  minReturnDate.setHours(23, 0, 0, 0); // 🔥 2:00 PM local time

  if (!newProducts[index].returnDate || returnDate < minReturnDate) {
    newProducts[index].returnDate = formatDateTimeLocal(minReturnDate);
  }
}


      // Validate pickup > return
      const returnDate = new Date(newProducts[index].returnDate);
      if (returnDate && selectedDate > returnDate) {
        toast.warn("Pickup date cannot be later than return date.");
        return;
      }
    }

    if (field === "returnDate") {
      const pickupDate = new Date(newProducts[index].pickupDate);
      if (selectedDate < pickupDate) {
        toast.warn("Return date cannot be earlier than pickup date.");
        return;
      }
    }

    // ✅ Don’t override time – use user-picked value
    newProducts[index][field] = value;

    // Update first product's shared state
    if (index === 0) {
      setFirstProductDates({
        ...firstProductDates,
        [field]: value,
      });
    }

    setProducts(newProducts);
  };





  // Function to handle product input changes

  const checkAvailability = async (index) => {
    const { productCode, pickupDate, returnDate, quantity } = products[index];
    const pickupDateObj = new Date(pickupDate);
    const returnDateObj = new Date(returnDate);
    const bookingId = await getNextBookingId(pickupDateObj, productCode); // Replace with actual booking ID logic if needed

    console.log('Checking availability for Product Code:', productCode);
    console.log('Pickup Date:', pickupDateObj, 'Return Date:', returnDateObj);
    console.log('Booking ID:', bookingId);

    try {
      // Fetch product from the correct branch subcollection
      const productRef = doc(db, `products/${userData.branchCode}/products`, productCode); // Change here for branchCode
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        const newProducts = [...products];
        newProducts[index].errorMessage = 'Product not found.';
        setProducts(newProducts);
        toast.error('Product not found:', productCode);
        return;
      }

      const productData = productDoc.data();
      const maxAvailableQuantity = productData.quantity || 0;

      console.log('Max Available Quantity for Product:', productCode, 'is', maxAvailableQuantity);

      // Fetch the bookings for the specific product under the branch
      const bookingsRef = collection(productRef, 'bookings');
      const qLess = query(bookingsRef, where('bookingId', '<', bookingId), orderBy('bookingId', 'asc'));
      const qGreater = query(bookingsRef, where('bookingId', '>', bookingId), orderBy('bookingId', 'asc'));

      const querySnapshotLess = await getDocs(qLess);
      const querySnapshotGreater = await getDocs(qGreater);

      const bookingsLess = [];
      const bookingsGreater = [];

      querySnapshotLess.forEach((doc) => {
        const bookingData = doc.data();
        bookingsLess.push({
          bookingId: bookingData.bookingId,
          pickupDate: bookingData.pickupDate.toDate(),
          returnDate: bookingData.returnDate.toDate(),
          quantity: bookingData.quantity,
        });
      });

      querySnapshotGreater.forEach((doc) => {
        const bookingData = doc.data();
        bookingsGreater.push({
          bookingId: bookingData.bookingId,
          pickupDate: bookingData.pickupDate.toDate(),
          returnDate: bookingData.returnDate.toDate(),
          quantity: bookingData.quantity,
        });
      });

      console.log('Bookings Less (Before Current Booking):', bookingsLess);
      console.log('Bookings Greater (After Current Booking):', bookingsGreater);

      let availableQuantity = maxAvailableQuantity;
      console.log('Initial Available Quantity:', availableQuantity);

      if (bookingsLess.length > 0 && bookingsGreater.length === 0) {
        console.log('Only Bookings Less exist.');

        const overlappingBookings = bookingsLess.filter(
          (booking) => booking.returnDate.getTime() > pickupDateObj
        );

        if (overlappingBookings.length > 0) {
          const totalOverlapQuantity = overlappingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
          console.log('Total Overlapping Quantity (less):', totalOverlapQuantity);
          availableQuantity -= totalOverlapQuantity;
          console.log('New Available Quantity after  Overlap:', availableQuantity);
        }
      } else if (bookingsGreater.length > 0 && bookingsLess.length === 0) {
        console.log('Only Bookings Greater exist.');

        const overlappingBookings = bookingsGreater.filter(
          (booking) => booking.pickupDate.getTime() < returnDateObj
        );

        if (overlappingBookings.length > 0) {
          const totalOverlapQuantity = overlappingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
          console.log('Total Overlapping Quantity (Greater):', totalOverlapQuantity);
          availableQuantity -= totalOverlapQuantity;
          console.log('New Available Quantity after Greater Overlap:', availableQuantity);
        }
      } else if (bookingsLess.length > 0 && bookingsGreater.length > 0) {
        console.log('Both Bookings Less and Greater exist.');

        const lessOverlapBookings = bookingsLess.filter(
          (booking) => booking.returnDate.getTime() > pickupDateObj.getTime()
        );
        const greaterOverlapBookings = bookingsGreater.filter(
          (booking) => booking.pickupDate.getTime() < returnDateObj.getTime() && booking.returnDate > pickupDateObj
        );

        let totalOverlapQuantity1 = 0;
        let totalOverlapQuantity2 = 0;

        if (lessOverlapBookings.length > 0) {
          totalOverlapQuantity1 += lessOverlapBookings.reduce((sum, booking) => sum + booking.quantity, 0);
          console.log('Overlapping Booking (Less):', totalOverlapQuantity1);
        }

        if (greaterOverlapBookings.length > 0) {
          totalOverlapQuantity2 += greaterOverlapBookings.reduce((sum, booking) => sum + booking.quantity, 0);
          console.log('Total Overlapping Quantity (Greater):', totalOverlapQuantity2);
        }
        let totalOverlapQuantity3 = totalOverlapQuantity1 + totalOverlapQuantity2;

        availableQuantity -= totalOverlapQuantity3;
        console.log('New Available Quantity after Combined Overlap:', availableQuantity);
      }

      if (availableQuantity < 0) {
        availableQuantity = 0;
        console.log('Available Quantity is negative, setting to 0');
      }

      console.log('Final Available Quantity:', availableQuantity);

      const newProducts = [...products];
      newProducts[index].availableQuantity = availableQuantity;
      newProducts[index].errorMessage = ''; // Clear error message if successful
      setProducts(newProducts);

    } catch (error) {
      toast.error('Error checking availability:', error);
      const newProducts = [...products];
      newProducts[index].errorMessage = 'Failed to check availability. Please try again.';
      setProducts(newProducts);
    }
  };


  const addProductForm = () => {
    if (products.length > 0) {
      const firstProduct = products[0]; // Get first product's pickup and return date
      setProducts([...products, {
        pickupDate: firstProduct.pickupDate,
        returnDate: firstProduct.returnDate,
        productCode: '',
        quantity: '',
        availableQuantity: null,
        errorMessage: '',
        productImageUrl: '',
        productName: '',
      }]);
    }
  };
  const removeProductForm = (index) => {
    const updatedProducts = products.filter((_, i) => i !== index);
    setProducts(updatedProducts);
  };



  const getNextBookingId = async (pickupDateObj, productCode) => {
    try {
      // Check if productCode is valid
      if (!productCode) {
        throw new Error('Invalid product code');
      }

      // Fetch the logged-in branchCode from user data
      const branchCode = userData.branchCode; // Assuming userData contains branchCode

      // Firestore reference to the specific product's bookings under the correct branch
      const productRef = doc(db, `products/${branchCode}/products`, productCode); // Updated reference
      const bookingsRef = collection(productRef, 'bookings');
      const q = query(bookingsRef, orderBy('pickupDate', 'asc'));

      const querySnapshot = await getDocs(q);

      const existingBookings = [];

      // Loop through the query snapshot to gather existing bookings
      querySnapshot.forEach((doc) => {
        const bookingData = doc.data();
        existingBookings.push({
          id: doc.id,
          bookingId: bookingData.bookingId,
          pickupDate: bookingData.pickupDate.toDate(),
          returnDate: bookingData.returnDate.toDate(),
          quantity: bookingData.quantity,
        });
      });

      // Calculate the next booking ID
      let newBookingId = existingBookings.length + 1;
      for (let i = 0; i < existingBookings.length; i++) {
        if (pickupDateObj.getTime() < existingBookings[i].pickupDate.getTime()) {
          newBookingId = i + 1;
          break;
        }
      }

      // Update existing bookings if necessary
      const batch = writeBatch(db);
      if (newBookingId <= existingBookings.length) {
        existingBookings.forEach((booking, index) => {
          if (index + 1 >= newBookingId) {
            const bookingDocRef = doc(bookingsRef, booking.id);
            batch.update(bookingDocRef, {
              bookingId: index + 2,
            });
          }
        });
      }

      await batch.commit();

      // Return the new booking ID for the current product
      return newBookingId;
    } catch (error) {
      toast.error('Error getting next booking ID:', error);
      setErrorMessage('Failed to get booking ID. Please try again.');
      return null;
    }
  };



  const handleBookingConfirmation = async (e) => {
    e.preventDefault();

    try {

      let bookingDetails = [];

      for (const product of products) {
        const pickupDateObj = new Date(product.pickupDate);
        const returnDateObj = new Date(product.returnDate);
        const millisecondsPerDay = 1000 * 60 * 60 * 24;
        const days = Math.ceil((returnDateObj - pickupDateObj) / millisecondsPerDay);

        // Get branchCode from userData (assumed to be available)
        const branchCode = userData.branchCode;

        // Reference to the specific product in the branch's collection
        const productRef = doc(db, `products/${branchCode}/products`, product.productCode); // Updated path
        const productDoc = await getDoc(productRef);

        if (!productDoc.exists()) {
          product.errorMessage = 'Product not found.';
          continue; // Skip this product if not found
        }

        const productData = productDoc.data();
        const { price, deposit, priceType, minimumRentalPeriod, extraRent, productName } = productData;

        const calculateTotalPrice = (price, deposit, priceType, quantity, pickupDate, returnDate, minimumRentalPeriod, extraRent) => {
          const pickupDateObj = new Date(pickupDate);
          const returnDateObj = new Date(returnDate);
          const millisecondsPerDay = 1000 * 60 * 60 * 24;
          const millisecondsPerHour = 1000 * 60 * 60;

          let duration = 0;

          // Determine the duration based on priceType
          if (priceType === 'hourly') {
            duration = Math.ceil((returnDateObj - pickupDateObj) / millisecondsPerHour); // Hours difference
          } else if (priceType === 'monthly') {
            duration = Math.ceil((returnDateObj - pickupDateObj) / (millisecondsPerDay * 30)); // Months difference
          } else {
            duration = Math.ceil((returnDateObj - pickupDateObj) / millisecondsPerDay); // Days difference
          }

          let totalPrice = 0;
          let extraDuration = duration - minimumRentalPeriod;

          if (duration <= minimumRentalPeriod) {
            // If the total duration is less than or equal to the minimum rental period
            totalPrice = price * quantity;
          } else {
            // Apply base price for minimum rental period
            totalPrice = price * quantity;

            // Apply extra rent for the remaining duration beyond the minimum rental period
            totalPrice += extraRent * extraDuration * quantity;
          }

          let totaldeposite = deposit * quantity;
          console.log("Price Type: ", priceType);
          console.log("Duration: ", duration);
          console.log("Extra Days/Hours: ", extraDuration);
          console.log("Price per unit: ", price);
          console.log("Extra Price per additional duration: ", extraRent);
          console.log("Calculated Total Price: ", totalPrice);

          return {
            totalPrice,
            deposit,
            totaldeposite,
            grandTotal: `${parseInt(totalPrice) + parseInt(totaldeposite)}`,
          };
        };

        const totalCost = calculateTotalPrice(
          price,
          deposit,
          priceType,
          product.quantity,
          pickupDateObj,
          returnDateObj,
          minimumRentalPeriod,
          extraRent,
        );

        const newBookingId = await getNextBookingId(pickupDateObj, product.productCode);

        // Log booking details for debugging
        console.log("Booking details:", {
          bookingId: newBookingId,
          pickupDate: pickupDateObj,
          returnDate: returnDateObj,
          quantity: parseInt(product.quantity, 10),
          userDetails,
          price,
          deposit,
          totalCost: totalCost.totalPrice,
          productName,
        });

        // Save booking details to Firestore
        bookingDetails.push({
          productCode: product.productCode,
          productImageUrl: product.imageUrl,
          deposit,
          price,
          numDays: days,
          quantity: product.quantity,
          totalPrice: totalCost.totalPrice,
          totaldeposite: totalCost.totaldeposite,
          grandTotal: totalCost.grandTotal,
          productName,
        });
      }

      setReceipt({
        products: bookingDetails,
      });

    } catch (error) {
      toast.error('Error confirming booking:', error);
      setErrorMessage('An error occurred while confirming your booking. Please try again.');
    }
  };


  const handleConfirmPayment = async () => {
    setIsButtonDisabled(true);
    try {

      // Generate receipt number
      const receiptNumber = await generateReceiptNumber(userData.branchCode);
      setReceiptNumber(receiptNumber);

      // Check availability of stock for all products
      const allQuantitiesAvailable = await Promise.all(
        products.map(async (product) => {
          const branchCode = userData.branchCode;
          const productRef = doc(db, `products/${branchCode}/products`, product.productCode); // Updated path
          const productDoc = await getDoc(productRef);

          if (!productDoc.exists()) {
            product.errorMessage = 'Product not found.';
            toast.warn(`Product not found for code: ${product.productCode}`);
            return false; // Skip this product if not found
          }

          const productData = productDoc.data();
          const availableQuantity = parseInt(product.availableQuantity || 0, 10); // Ensure integer conversion
          const requestedQuantity = parseInt(product.quantity, 10); // Ensure integer conversion for requested quantity

          // Log the values to ensure they are correct
          console.log(`Product Code: ${product.productCode}`);
          console.log(`Available Quantity: ${availableQuantity}`);
          console.log(`Requested Quantity: ${requestedQuantity}`);

          // Check if the requested quantity is within the available stock
          if (requestedQuantity > availableQuantity) {
            toast.warning(`Not enough stock for product: ${product.productCode}`);
            product.errorMessage = 'Insufficient stock for this product.';
            return false; // Return false if not enough stock
          }

          return true; // Return true if sufficient stock
        })
      );

      // Check if all products have sufficient stock
      const allAvailable = allQuantitiesAvailable.every((isAvailable) => isAvailable);
      if (!allAvailable) {
        toast.warn('One or more products do not have enough stock. Please adjust the quantity.');
        return; // Exit the function without proceeding with booking
      }

      // Process each product for booking
      for (const product of products) {
        const pickupDateObj = new Date(product.pickupDate);
        const returnDateObj = new Date(product.returnDate);

        const branchCode = userData.branchCode;
        const productRef = doc(db, `products/${branchCode}/products`, product.productCode); // Updated path
        const productDoc = await getDoc(productRef);

        if (!productDoc.exists()) {
          product.errorMessage = 'Product not found.';
          continue; // Skip this product if not found
        }

        const productData = productDoc.data();
        const { price, deposit, priceType, minimumRentalPeriod, extraRent } = productData;

        // Calculate the total price
        const calculateTotalPrice = (price, deposit, priceType, quantity, pickupDate, returnDate, minimumRentalPeriod, extraRent) => {
          const pickupDateObj = new Date(pickupDate);
          const returnDateObj = new Date(returnDate);
          const millisecondsPerDay = 1000 * 60 * 60 * 24;
          const millisecondsPerHour = 1000 * 60 * 60;

          let duration = 0;

          // Determine the duration based on priceType
          if (priceType === 'hourly') {
            duration = Math.ceil((returnDateObj - pickupDateObj) / millisecondsPerHour); // Hours difference
          } else if (priceType === 'monthly') {
            duration = Math.ceil((returnDateObj - pickupDateObj) / (millisecondsPerDay * 30)); // Months difference
          } else {
            duration = Math.ceil((returnDateObj - pickupDateObj) / millisecondsPerDay); // Days difference
          }

          let totalPrice = 0;
          let extraDuration = duration - minimumRentalPeriod;

          if (duration <= minimumRentalPeriod) {
            // If the total duration is less than or equal to the minimum rental period
            totalPrice = price * quantity;
          } else {
            // Apply base price for minimum rental period
            totalPrice = price * quantity;

            // Apply extra rent for the remaining duration beyond the minimum rental period
            totalPrice += extraRent * extraDuration * quantity;
          }

          let totaldeposite = deposit * quantity;
          console.log("Price Type: ", priceType);
          console.log("Duration: ", duration);
          console.log("Extra Days/Hours: ", extraDuration);
          console.log("Price per unit: ", price);
          console.log("Extra Price per additional duration: ", extraRent);
          console.log("Calculated Total Price: ", totalPrice);

          return {
            totalPrice,
            deposit,
            totaldeposite,
            grandTotal: `${parseInt(totalPrice) + parseInt(totaldeposite)}`,
          };
        };

        const totalCost = calculateTotalPrice(
          price,
          deposit,
          priceType,
          product.quantity,
          pickupDateObj,
          returnDateObj,
          minimumRentalPeriod,
          extraRent,
        );

        const newBookingId = await getNextBookingId(pickupDateObj, product.productCode);
        const createdAt = new Date();

        // Add booking to Firestore under the specific branch and product
        await addDoc(collection(productRef, 'bookings'), {
          bookingId: newBookingId,
          receiptNumber,
          pickupDate: pickupDateObj,
          returnDate: returnDateObj,
          quantity: parseInt(product.quantity, 10),
          userDetails, // Assuming userDetails is the same for all products
          price, // Save price
          deposit,
          priceType,
          minimumRentalPeriod,
          extraRent,
          totalCost: totalCost.totalPrice,
          createdAt, // Save creation timestamp
          appliedCredit: appliedCredit,
        });
      }

      // ... within your function
      if (creditNoteId && appliedCredit > 0) {
        const creditNoteRef = doc(db, `products/${userData.branchCode}/creditNotes`, creditNoteId);
        const creditNoteSnap = await getDoc(creditNoteRef);
        if (creditNoteSnap.exists()) {
          const currentCredit = creditNoteSnap.data().Balance || 0;
          const totalcredit = creditNoteSnap.data().amount || 0;
          const remainingCredit = currentCredit - appliedCredit;
          const creditUsed = totalcredit - remainingCredit;

          await updateDoc(creditNoteRef, {
            Balance: remainingCredit,
            CreditUsed: creditUsed,
            status: remainingCredit > 0 ? 'active' : 'used',
            usedReceipts: arrayUnion(receiptNumber),
          });

          toast.success('Credit note updated.');
        } else {
          toast.error('Error updating credit note: Credit note not found.');
        }
      }


      // Set payment confirmation state and redirect
      setIsPaymentConfirmed(true);
      toast.success(`Bill Created Successfully. Your Receipt Number is: ${receiptNumber}`);
      setTimeout(() => navigate('/usersidebar/clients'), 6000); // 6 seconds delay before navigation

    } catch (error) {
      toast.error('Error confirming payment:', error);
      setErrorMessage(error.message);
    }
    finally {
      // Re-enable the button after 10 seconds
      setTimeout(() => setIsButtonDisabled(false), 10000);
    }
  };




  const handleApplyCredit = () => {
    const finalRent = Number(userDetails.finalrent) || 0;

    if (availableCredit > 0 && finalRent > 0) {
      const creditToApply = Math.min(availableCredit, finalRent);
      const updatedFinalRent = finalRent - creditToApply;
      const totalAmount = updatedFinalRent + Number(userDetails.finaldeposite || 0);
      const balance = totalAmount - Number(userDetails.amountpaid || 0);

      setAppliedCredit(creditToApply);

      setUserDetails((prev) => ({
        ...prev,
        finalrent: updatedFinalRent,
        creditNoteAmountAppliedToRent: creditToApply,
        totalamounttobepaid: totalAmount,
        balance,
      }));

      toast.success(`Applied credit of ₹${creditToApply}`);
    } else {
      toast.info('No credit available to apply.');
    }
  };




  const toggleAvailabilityForm = () => {
    setIsAvailabilityFormVisible(!isAvailabilityFormVisible);
  };

  const toggleAvailability1Form = () => {

    // Function to check if all entered quantities are less than or equal to available quantities
    const allQuantitiesAvailable = products.every(product => {
      return parseInt(product.quantity, 10) <= (product.availableQuantity || 0);
    });

    if (allQuantitiesAvailable) {
      setIsAvailability1FormVisible(!isAvailability1FormVisible);
    } else {
      toast.error('Entered quantities exceed available quantities for one or more products.');
    }

  };

  // const handleDeleteProduct = (index) => {
  //   // Create a copy of the products array without the product at the specified index
  //   const updatedProducts = receipt.products.filter((_, productIndex) => productIndex !== index);

  //   // Update the receipt object with the new product list
  //   setReceipt((prevReceipt) => ({
  //     ...prevReceipt,
  //     products: updatedProducts,
  //   }));

  //   // Optionally, update the total price and other related calculations here
  // };

  const handleDeleteProduct = (productCode) => {
    // Update products state by filtering out the deleted product
    setProducts((prevProducts) =>
      prevProducts.filter((product) => product.productCode !== productCode)
    );

    // Update receipt state if you have a separate receipt state
    setReceipt((prevReceipt) => ({
      ...prevReceipt,
      products: prevReceipt.products.filter((product) => product.productCode !== productCode)
    }));
  };
  const calculateGrandTotalRent = () => {
    return receipt.products.reduce((total, product) => total + product.totalPrice, 0);
  };
  useEffect(() => {
    if (receipt && receipt.products) {
      const grandTotalRent = calculateGrandTotalRent();
      setUserDetails(prevDetails => ({
        ...prevDetails,
        grandTotalRent
      }));
    }
  }, [receipt]);
  const calculateGrandTotalDeposite = () => {
    return receipt.products.reduce((total, product) => total + product.totaldeposite, 0);
  };
  useEffect(() => {
    if (receipt && receipt.products) {
      const grandTotalDeposit = calculateGrandTotalDeposite();
      setUserDetails(prevDetails => ({
        ...prevDetails,
        grandTotalDeposit
      }));
    }
  }, [receipt]);


  // Calculate final rent, deposit, and amount to be paid
  useEffect(() => {

    const finalrent = userDetails.grandTotalRent - (userDetails.discountOnRent || 0) - (appliedCredit || 0);
    const finaldeposite = userDetails.grandTotalDeposit - (userDetails.discountOnDeposit || 0);
    const totalamounttobepaid = finalrent + finaldeposite;
    const balance = totalamounttobepaid - (userDetails.amountpaid || 0);

    setUserDetails(prevDetails => ({
      ...prevDetails,
      finalrent,
      finaldeposite,
      totalamounttobepaid,
      balance,
    }));
  }, [userDetails.grandTotalRent, userDetails.discountOnRent, userDetails.grandTotalDeposit, userDetails.discountOnDeposit, userDetails.amountpaid]);





  useEffect(() => {
    const fetchSubUsers = async () => {
      if (!userData.branchCode) return;

      try {
        const subUsersRef = collection(db, `products/${userData.branchCode}/subusers`);
        const querySnapshot = await getDocs(subUsersRef);

        const subUsersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setSubUsers(subUsersData); // Assuming you have a state called subUsers
      } catch (error) {
        console.error('Error fetching sub-users:', error);
      }
    };

    fetchSubUsers();
  }, [userData.branchCode]);

  const calculateFinalPrice = () => {
    return userDetails.finalrent - appliedCredit;
  };
  // Handle the selection of a sub-user

const formatDateTimeLocal = (date) => {
  const pad = (n) => String(n).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};




  return (
    <div className="booking-container1">
      <UserHeader onMenuClick={toggleSidebar} />
      <div className='issidebar'>
        <UserSidebar isOpen={isSidebarOpen} />
        <button onClick={toggleAvailabilityForm} className='availability-toogle-button'>
          {isAvailabilityFormVisible ? '' : ''}
        </button>

        {isAvailabilityFormVisible && (

          <div>

            <h8>Check Product  Avalibility</h8>
            {products.map((product, index) => (
              <div key={index} className="product-check" style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd', background: '#ffffff', }}>
                <div className="date-row" style={{ width: '700px', display: 'flex', marginTop: '100px', }}>
                  <div className="form-group1" style={{ flex: '0 0 45%', marginRight: '0px' }}>
                    <label>Pickup Date</label>
                    <input
                      type="datetime-local"
                      name="pickupDate"
                      value={product.pickupDate}
                      onChange={(e) => handleFirstProductDateChange(e, "pickupDate", index)}
                      min={new Date().toISOString().slice(0, 16)} disabled={index > 0}
                      required
                    />
                  </div>
                  <div className="form-group1" style={{ flex: '0 0 45%', marginLeft: "70px" }} >
                    <label>Return Date</label>

                    <input
                      type="datetime-local"
                      name="returnDate"
                      value={product.returnDate}
                      onChange={(e) => handleFirstProductDateChange(e, "returnDate", index)}
                      min={new Date().toISOString().slice(0, 16)} disabled={index > 0}
                      required
                    />
                  </div>
                </div>
                <div className="form-group1" >
                  <label>Product Code</label>
                  <input
                    type="text"
                    name="productCode"
                    value={product.productCode}
                    onChange={(e) => handleProductChange(index, e)}
                    required
                  />
                  {productSuggestions.length > 0 && (
                    <ul className="suggestions-dropdown" style={{ border: '1px solid #ccc', maxHeight: '100px', overflowY: 'auto', listStyle: 'none', padding: '5px', margin: 0 }}>
                      {productSuggestions.map((suggestion, idx) => (
                        <li
                          key={idx}
                          style={{ padding: '5px', cursor: 'pointer', borderBottom: '1px solid #ddd' }}
                          onClick={() => handleSuggestionClick(index, suggestion)}
                        >
                          {suggestion.productCode} - {suggestion.productName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>


                <div className="form-group1">
                  <label>Quantity</label>
                  <input
                    type="text"
                    name="quantity"
                    value={product.quantity}
                    onChange={(e) => handleProductChange(index, e)}
                    required
                  />
                </div>
                <div className="form-group1">
                  <label>Product Name</label>
                  <input
                    type="text"
                    name="productName"
                    value={product.productName}
                    readOnly


                  />
                </div>
                <div className="date-row" style={{ width: '700px', display: 'flex' }}>
                  <div className="form-group1" style={{ flex: '0 0 45%', marginRight: '0px' }}>
                    <label>Rent</label>
                    <input
                      type="text"
                      id="Rent"
                      value={product.price}
                      readOnly
                      placeholder="₹ 00.00"
                    />
                  </div>
                  <div className="form-group1" style={{ flex: '0 0 45%', marginLeft: "70px" }} >
                    <label>Deposit</label>
                    <input
                      type="text"
                      id="Deposite"
                      value={product.deposit}
                      readOnly
                      placeholder='₹ 00.00'

                    />
                  </div>
                </div>
                {products.length > 1 && index > 0 && (
                  <FaTrash type="button" className='cancel-button' onClick={() => removeProductForm(index)} />
                )}
                <div className='total-quantity-display'>
                  <p className='quantity-item1'>Total Quantity: {product.totalQuantity}</p>
                  {product.errorMessage ? (
                    <span style={{ color: 'red' }}>{product.errorMessage}</span>
                  ) : (
                    product.availableQuantity !== null && (
                      <>

                        <p className='quantity-item2'>Booked Quantity: {product.totalQuantity - product.availableQuantity}</p>
                      </>
                    )
                  )}
                </div>




                <div className="product-image-container1">
                  {product.imageUrl && ( // Change from productImageUrl to product.imageUrl
                    <img src={product.imageUrl} alt="Product" className="product-image1" />
                  )}
                </div>


                <div className="available-quantity-display">
                  {product.errorMessage ? (
                    <span style={{ color: 'red' }}>{product.errorMessage}</span>
                  ) : (
                    product.availableQuantity !== null && (
                      <>

                        <p>Available Quantity: {product.availableQuantity}</p>
                      </>
                    )
                  )}
                </div>





                <button type="button" className='checkavailability' onClick={() => checkAvailability(index)}>Check Availability</button>


              </div>
            ))}
            <button className='checkavailability11' onClick={addProductForm}>Add New Product</button>


          </div>
        )}

        <button onClick={toggleAvailability1Form} className='availability1-toogle-button'>
          {isAvailability1FormVisible ? 'Create Bill' : 'Create Bill'}
        </button>


        {isAvailability1FormVisible && (

          <form onSubmit={handleBookingConfirmation}>
            <div className='customer-details-form'>
              <h9>Customer Details</h9>

              <div className="date-row" style={{ width: '700px', display: 'flex', marginTop: '80px', }}>
                <div className="form-group1" style={{ flex: '0 0 45%', marginRight: '0px', }} >
                  <label>Name</label>
                  <input
                    type="text"
                    value={userDetails.name}
                    onChange={(e) => setUserDetails({ ...userDetails, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group1" style={{ flex: '0 0 45%', marginRight: '0px' }}>
                  <label>Email Id</label>
                  <input
                    type="email"
                    value={userDetails.email}
                    onChange={(e) => setUserDetails({ ...userDetails, email: e.target.value })}

                  />
                </div>
              </div>

              <div className="date-row" style={{ width: '700px', display: 'flex', }}>

                <div className="form-group1" style={{ flex: '0 0 45%', marginRight: '0px' }}>
                  <label htmlFor="contact">Contact Number:</label>
                  <input
                    type="text"
                    id="contact"
                    name="contact"
                    value={userDetails.contact}
                    onChange={handleInputChange}
                    required
                  />
                  {availableCredit > 0 && (
                    <div className="credit-info">
                      Available Credit: ₹{availableCredit.toFixed(2)}{' '}

                    </div>
                  )}

                </div>
                <div className="form-group1" style={{ flex: '0 0 45%', marginRight: '0px' }}>
                  <label>Alternative Phone Number</label>
                  <input
                    type="text"
                    value={userDetails.alternativecontactno}
                    onChange={(e) => setUserDetails({ ...userDetails, alternativecontactno: e.target.value })}

                  />
                </div>
              </div>
              <div className="form-group1">
                <label>Identity Proof</label>
                <select
                  value={userDetails.identityproof}
                  onChange={(e) => setUserDetails({ ...userDetails, identityproof: e.target.value })}

                >
                  <option value="" disabled>Select identity proof </option>
                  <option value="aadharcard" >Aadhaar Card</option>
                  <option value="pancard">Pan Card</option>
                  <option value="drivinglicence">Driving Licence</option>
                  <option value="passport">Passport</option>
                  <option value="college/officeid">College/Office Id </option>
                </select>
              </div>
              <div className="form-group1">
                <label>Identity Proof Number</label>
                <input
                  type="text"
                  value={userDetails.identitynumber}
                  onChange={(e) => setUserDetails({ ...userDetails, identitynumber: e.target.value })}

                />
              </div>
              <div className="form-group1">
                <label>Source</label>
                <select
                  value={userDetails.source}
                  onChange={(e) => setUserDetails({ ...userDetails, source: e.target.value })}

                >
                  <option value="" disabled>Select the source</option>
                  <option value="google" >Google</option>
                  <option value="instagram" >Instagram</option>
                  <option value="facebook" >Facebook</option>

                  <option value="friendsandfamily" >Friends And Family</option>
                  <option value="repeatcustomer">Repeat Customer</option>
                  <option value="referal">Referral</option>
                  <option value="walkin">Walk-In</option>

                </select>
              </div>


              <div className="form-group1">
                <label>Customer By</label>
                <select
                  value={userDetails.customerby}
                  onChange={(e) => setUserDetails({ ...userDetails, customerby: e.target.value })}
                  required
                >
                  <option value="" disabled>Select customer by</option>
                  <option value="manager" >manager</option>
                  {subUsers.map((subuser) => (
                    <option key={subuser.id} value={subuser.name}>
                      {subuser.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group1">
                <label>Receipt By</label>
                <select
                  value={userDetails.receiptby}
                  onChange={(e) => setUserDetails({ ...userDetails, receiptby: e.target.value })}
                  required
                >
                  <option value="" disabled>Select receipt by</option>
                  <option value="manager" >manager</option>
                  {subUsers.map((subuser) => (
                    <option key={subuser.id} value={subuser.name}>
                      {subuser.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group1">
                <label>Stage</label>
                <select
                  value={userDetails.stage}
                  onChange={(e) => setUserDetails({ ...userDetails, stage: e.target.value })}
                  required
                >
                  <option value="Booking" >Booking</option>
                  <option value="pickup">Pickup</option>
                </select>
              </div>
              <button type="submit" className='confirm-booking-button'>Confirm Booking</button>
            </div>
          </form>
        )}

        {receipt && (
          <div className="receipt-container">

            {receiptNumber && <h3>(Receipt No: {receiptNumber})</h3>}

            {/* Render the headings only once */}
            <div className="receipt-row">
              <div className="receipt-column">
                <strong>Product Image</strong>
              </div>
              <div className="receipt-column">
                <strong>Product Name</strong>
              </div>

              <div className="receipt-column">
                <strong>Product Code</strong>
              </div>
              <div className="receipt-column">
                <strong>Quantity</strong>
              </div>
              <div className="receipt-column">
                <strong>Rent</strong>
              </div>
              <div className="receipt-column">
                <strong>Deposit</strong>
              </div>




              <div className="receipt-column">
                <strong>Total Price</strong>

              </div>
              <div className="receipt-column">
                <strong>Total Deposit</strong>
              </div>
              <div className="receipt-column">
                <strong>Action</strong>
              </div>

            </div>

            {/* Now map over products and display only the values */}
            {receipt.products.map((product, index) => (
              <div key={index} className="receipt-values">
                <div className="receipt-column">
                  {product.productImageUrl && (
                    <img src={product.productImageUrl} alt="Product" style={{ width: '30px', height: '30px' }} />
                  )}
                </div>
                <div className="receipt-column">{product.productName}</div>
                <div className="receipt-column">{product.productCode}</div>
                <div className="receipt-column">{product.quantity}</div>
                <div className="receipt-column">₹{product.price}</div>
                <div className="receipt-column">₹{product.deposit}</div>




                <div className="receipt-column">₹{product.totalPrice}</div>
                <div className="receipt-column">₹{product.totaldeposite}</div>
                <div className="receipt-column">
                  <FaTrash onClick={() => handleDeleteProduct(product.productCode)}
                    style={{ cursor: 'pointer', color: 'red' }}
                  /> {/* Delete icon */}
                </div>

              </div>
            ))}
            <div className="receipt-row">
              <div className="receipt-row">
                <strong>Alterations:</strong>
              </div>
              <div className="receipt-column1">
                <input
                  type="text"
                  value={userDetails.alterations}
                  onChange={(e) => setUserDetails({ ...userDetails, alterations: e.target.value })}

                />
              </div>
            </div>
            <button onClick={() => setIsPaymentFormVisible(true)} className='receiptconfirmpayment'>
              Proceed To Payment
            </button>

            {isPaymentFormVisible && (
              <div className="payment-form-container" style={{ marginTop: '80px', }} >
                <div style={{ width: '260px', display: 'flex', marginTop: '50px', marginLeft: '20px', fontFamily: 'Public Sans', fontStyle: 'normal', fontWeight: '500', fontSize: '22px', lineHeight: '26px', color: '#000000' }}>Payment Details</div>
                <div className="date-row" style={{ width: '700px', display: 'flex', marginTop: '80px', }}>

                  <div className="payment-form row1" style={{ flex: '0 0 30%', marginRight: '0px' }} >
                    <div className="payment-form-row">
                      <label>Grand Total Rent</label>
                      <input
                        type="text"
                        value={userDetails.grandTotalRent}
                        readOnly
                      />
                    </div>

                    <div className="payment-form-row">
                      <label>Grand Total Deposit</label>
                      <input
                        type="text"
                        value={userDetails.grandTotalDeposit}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="payment-form row1" style={{ flex: '0 0 30%', marginLeft: "70px" }} >

                    <div className="payment-form-row">
                      <label style={{ color: 'green' }}>Discount on Rent</label>
                      <input
                        type="text"
                        style={{ color: 'green !important' }}
                        value={userDetails.discountOnRent}
                        onChange={(e) => setUserDetails({ ...userDetails, discountOnRent: e.target.value })}
                      />
                    </div>

                    <div className="payment-form-row">
                      <label style={{ color: 'green' }}>Discount on Deposit</label>
                      <input
                        type="text"
                        style={{ color: 'green !important' }}
                        value={userDetails.discountOnDeposit}
                        onChange={(e) => setUserDetails({ ...userDetails, discountOnDeposit: e.target.value })}
                      />
                    </div>

                  </div>


                  <div className="payment-form row1" style={{ flex: '0 0 30%', marginLeft: "70px" }} >
                    <div className="payment-form-row">
                      <label>Final Rent</label>
                      <input
                        type="text"
                        value={userDetails.finalrent}
                        readOnly
                      />
                    </div>

                    <div className="payment-form-row">
                      <label>Final Deposit</label>
                      <input
                        type="text"
                        value={userDetails.finaldeposite}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="payment-form row1" style={{ flex: '0 0 30%', marginLeft: "70px" }}>
                    <div className="payment-form-row">
                      <label>Available Credit</label>
                      <input
                        type="text"
                        value={availableCredit > 0 ? `₹${availableCredit.toFixed(2)}` : '—'}
                        readOnly
                      />
                    </div>
                    <div className="payment-form-row">
                      <label>Applied Credit</label>
                      <input
                        type="text"
                        value={appliedCredit > 0 ? `₹${appliedCredit.toFixed(2)}` : '—'}
                        readOnly
                      />
                    </div>

                    <div className="payment-form-row">
                      {appliedCredit === 0 && availableCredit > 0 && (
                        <button onClick={handleApplyCredit} className="apply-credit-button">
                          Apply Credit
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* Display Total Amount to be Paid */}
                <div className="date-row" style={{ width: '700px', display: 'flex', }}>


                  <div className="payment-form-row" style={{ flex: '0 0 30%', marginRight: '0px' }}>
                    <label> Total Amount to be Paid</label>
                    <input
                      type="text"
                      value={userDetails.totalamounttobepaid}

                    />
                  </div>
                  <div className="payment-form-row" style={{ flex: '0 0 30%', marginLeft: "70px" }}>
                    <label style={{ color: 'green' }}>Amount Paid/Advance</label>
                    <input
                      type="text"
                      value={userDetails.amountpaid}
                      style={{ color: 'green !important' }}
                      onChange={(e) => setUserDetails({ ...userDetails, amountpaid: e.target.value })}

                    />
                  </div>

                  {/* Display Balance (Amount to be Paid - Amount Paid) */}
                  <div className="payment-form-row" style={{ flex: '0 0 30%', marginLeft: "70px" }}>
                    <label>Balance (if any)</label>
                    <input
                      type="text"
                      value={userDetails.balance}
                      readOnly
                    />
                  </div>
                </div>

                <div className="payment-form-row" style={{ width: '600px' }}>
                  <label>Payment Status</label>
                  <select
                    value={userDetails.paymentstatus}
                    onChange={(e) => setUserDetails({ ...userDetails, paymentstatus: e.target.value })}

                  >
                    <option value="fullpayment" >Full Payment</option>
                    <option value="depositpending">Deposit Pending</option>
                    <option value="partialpayment">Partial Payment</option>


                  </select>
                </div>
                <div className="date-row" style={{ width: '700px', display: 'flex', }}>


                  <div className="payment-form-row2" style={{ flex: '0 0 45%', marginRight: '0px' }}>
                    <label>1st Payment Mode </label>
                    <select
                      value={userDetails.firstpaymentmode}
                      onChange={(e) => setUserDetails({ ...userDetails, firstpaymentmode: e.target.value })}

                    >
                     <option value="">Select Mode</option>
                      <option value="upi" >UPI</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>


                    </select>
                  </div>
                  <div className="payment-form-row" style={{ flex: '0 0 45%', marginLeft: "70px" }}>
                    <label>1st Payment Details</label>
                    <input
                      type="text"
                      value={userDetails.firstpaymentdtails}
                      onChange={(e) => setUserDetails({ ...userDetails, firstpaymentdtails: e.target.value })}
                    />
                  </div>
                </div>
                <div className="date-row" style={{ width: '700px', display: 'flex', }}>

                  <div className="payment-form-row2" style={{ flex: '0 0 45%', marginRight: '0px' }}>
                    <label>2nd Payment Mode (if any) </label>
                    <select
                      value={userDetails.secondpaymentmode}
                      onChange={(e) => setUserDetails({ ...userDetails, secondpaymentmode: e.target.value })}

                    >
                      <option value="">Select Mode</option>

                      <option value="upi" >UPI</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>


                    </select>
                  </div>
                  <div className="payment-form-row" style={{ flex: '0 0 45%', marginLeft: "70px" }}>
                    <label>2nd Payment Details (if any)</label>
                    <input
                      type="text"
                      value={userDetails.secondpaymentdetails}
                      onChange={(e) => setUserDetails({ ...userDetails, secondpaymentdetails: e.target.value })}
                    />
                  </div>
                </div>

                <div className="payment-form-row">
                  <label>Special Note/followup Comment</label>
                  <input
                    type="text"
                    value={userDetails.specialnote}
                    onChange={(e) => setUserDetails({ ...userDetails, specialnote: e.target.value })}
                  />
                </div>



                {/* Add more fields as needed */}

                <button
                  onClick={handleConfirmPayment}
                  className="submit-payment-button"
                  disabled={isButtonDisabled}
                >
                  {isButtonDisabled ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            )}






          </div>
        )}
      </div>
      <ToastContainer />

    </div>
  );
}

export default Booking;