// Reusable reference data: major cities of Pakistan, across every province
// and territory. This is the single source of truth for any city list in
// the app (currently: the checkout Shipping Address dropdown, and its
// matching server-side validation) — add or remove a city here and every
// consumer picks it up automatically.
//
// Each record is an object rather than a bare string so it can carry more
// fields later without changing shape for existing consumers, e.g.:
//   shippingZone, estimatedDeliveryDays, shippingCharge
// Those are intentionally not present yet — add them here when that
// feature is actually built.

const PAKISTAN_CITIES = [
  // Punjab
  { name: 'Attock', province: 'Punjab' },
  { name: 'Bahawalnagar', province: 'Punjab' },
  { name: 'Bahawalpur', province: 'Punjab' },
  { name: 'Bhakkar', province: 'Punjab' },
  { name: 'Chakwal', province: 'Punjab' },
  { name: 'Chiniot', province: 'Punjab' },
  { name: 'Dera Ghazi Khan', province: 'Punjab' },
  { name: 'Faisalabad', province: 'Punjab' },
  { name: 'Gujranwala', province: 'Punjab' },
  { name: 'Gujrat', province: 'Punjab' },
  { name: 'Hafizabad', province: 'Punjab' },
  { name: 'Jhang', province: 'Punjab' },
  { name: 'Jhelum', province: 'Punjab' },
  { name: 'Kamoke', province: 'Punjab' },
  { name: 'Kasur', province: 'Punjab' },
  { name: 'Khanewal', province: 'Punjab' },
  { name: 'Khushab', province: 'Punjab' },
  { name: 'Kot Addu', province: 'Punjab' },
  { name: 'Lahore', province: 'Punjab' },
  { name: 'Layyah', province: 'Punjab' },
  { name: 'Lodhran', province: 'Punjab' },
  { name: 'Mandi Bahauddin', province: 'Punjab' },
  { name: 'Mianwali', province: 'Punjab' },
  { name: 'Multan', province: 'Punjab' },
  { name: 'Muzaffargarh', province: 'Punjab' },
  { name: 'Nankana Sahib', province: 'Punjab' },
  { name: 'Narowal', province: 'Punjab' },
  { name: 'Okara', province: 'Punjab' },
  { name: 'Pakpattan', province: 'Punjab' },
  { name: 'Rahim Yar Khan', province: 'Punjab' },
  { name: 'Rawalpindi', province: 'Punjab' },
  { name: 'Sahiwal', province: 'Punjab' },
  { name: 'Sargodha', province: 'Punjab' },
  { name: 'Sheikhupura', province: 'Punjab' },
  { name: 'Sialkot', province: 'Punjab' },
  { name: 'Toba Tek Singh', province: 'Punjab' },
  { name: 'Vehari', province: 'Punjab' },
  { name: 'Wah Cantonment', province: 'Punjab' },

  // Sindh
  { name: 'Badin', province: 'Sindh' },
  { name: 'Dadu', province: 'Sindh' },
  { name: 'Ghotki', province: 'Sindh' },
  { name: 'Hyderabad', province: 'Sindh' },
  { name: 'Jacobabad', province: 'Sindh' },
  { name: 'Jamshoro', province: 'Sindh' },
  { name: 'Karachi', province: 'Sindh' },
  { name: 'Kashmore', province: 'Sindh' },
  { name: 'Khairpur', province: 'Sindh' },
  { name: 'Larkana', province: 'Sindh' },
  { name: 'Mirpur Khas', province: 'Sindh' },
  { name: 'Naushahro Feroze', province: 'Sindh' },
  { name: 'Nawabshah', province: 'Sindh' },
  { name: 'Sanghar', province: 'Sindh' },
  { name: 'Shikarpur', province: 'Sindh' },
  { name: 'Sukkur', province: 'Sindh' },
  { name: 'Tando Adam', province: 'Sindh' },
  { name: 'Tando Allahyar', province: 'Sindh' },
  { name: 'Tando Muhammad Khan', province: 'Sindh' },
  { name: 'Thatta', province: 'Sindh' },
  { name: 'Umerkot', province: 'Sindh' },

  // Khyber Pakhtunkhwa
  { name: 'Abbottabad', province: 'Khyber Pakhtunkhwa' },
  { name: 'Bannu', province: 'Khyber Pakhtunkhwa' },
  { name: 'Battagram', province: 'Khyber Pakhtunkhwa' },
  { name: 'Buner', province: 'Khyber Pakhtunkhwa' },
  { name: 'Charsadda', province: 'Khyber Pakhtunkhwa' },
  { name: 'Chitral', province: 'Khyber Pakhtunkhwa' },
  { name: 'Dera Ismail Khan', province: 'Khyber Pakhtunkhwa' },
  { name: 'Hangu', province: 'Khyber Pakhtunkhwa' },
  { name: 'Haripur', province: 'Khyber Pakhtunkhwa' },
  { name: 'Karak', province: 'Khyber Pakhtunkhwa' },
  { name: 'Kohat', province: 'Khyber Pakhtunkhwa' },
  { name: 'Lakki Marwat', province: 'Khyber Pakhtunkhwa' },
  { name: 'Lower Dir', province: 'Khyber Pakhtunkhwa' },
  { name: 'Malakand', province: 'Khyber Pakhtunkhwa' },
  { name: 'Mansehra', province: 'Khyber Pakhtunkhwa' },
  { name: 'Mardan', province: 'Khyber Pakhtunkhwa' },
  { name: 'Mingora', province: 'Khyber Pakhtunkhwa' },
  { name: 'Nowshera', province: 'Khyber Pakhtunkhwa' },
  { name: 'Peshawar', province: 'Khyber Pakhtunkhwa' },
  { name: 'Shangla', province: 'Khyber Pakhtunkhwa' },
  { name: 'Swabi', province: 'Khyber Pakhtunkhwa' },
  { name: 'Tank', province: 'Khyber Pakhtunkhwa' },
  { name: 'Upper Dir', province: 'Khyber Pakhtunkhwa' },

  // Balochistan
  { name: 'Chaman', province: 'Balochistan' },
  { name: 'Dera Allah Yar', province: 'Balochistan' },
  { name: 'Dera Murad Jamali', province: 'Balochistan' },
  { name: 'Gwadar', province: 'Balochistan' },
  { name: 'Hub', province: 'Balochistan' },
  { name: 'Kalat', province: 'Balochistan' },
  { name: 'Kharan', province: 'Balochistan' },
  { name: 'Khuzdar', province: 'Balochistan' },
  { name: 'Loralai', province: 'Balochistan' },
  { name: 'Mastung', province: 'Balochistan' },
  { name: 'Nushki', province: 'Balochistan' },
  { name: 'Panjgur', province: 'Balochistan' },
  { name: 'Pishin', province: 'Balochistan' },
  { name: 'Quetta', province: 'Balochistan' },
  { name: 'Sibi', province: 'Balochistan' },
  { name: 'Turbat', province: 'Balochistan' },
  { name: 'Usta Muhammad', province: 'Balochistan' },
  { name: 'Zhob', province: 'Balochistan' },
  { name: 'Ziarat', province: 'Balochistan' },

  // Islamabad Capital Territory
  { name: 'Islamabad', province: 'Islamabad Capital Territory' },

  // Gilgit-Baltistan
  { name: 'Astore', province: 'Gilgit Baltistan' },
  { name: 'Chilas', province: 'Gilgit Baltistan' },
  { name: 'Ghanche', province: 'Gilgit Baltistan' },
  { name: 'Ghizer', province: 'Gilgit Baltistan' },
  { name: 'Gilgit', province: 'Gilgit Baltistan' },
  { name: 'Hunza', province: 'Gilgit Baltistan' },
  { name: 'Skardu', province: 'Gilgit Baltistan' },

  // Azad Jammu & Kashmir
  { name: 'Bagh', province: 'Azad Jammu & Kashmir' },
  { name: 'Bhimber', province: 'Azad Jammu & Kashmir' },
  { name: 'Kotli', province: 'Azad Jammu & Kashmir' },
  { name: 'Mirpur', province: 'Azad Jammu & Kashmir' },
  { name: 'Muzaffarabad', province: 'Azad Jammu & Kashmir' },
  { name: 'Neelum', province: 'Azad Jammu & Kashmir' },
  { name: 'Rawalakot', province: 'Azad Jammu & Kashmir' }
];

// Sorted city names for dropdowns.
function getCityNames() {
  return PAKISTAN_CITIES.map(c => c.name).sort((a, b) => a.localeCompare(b));
}

// Server-side validation: is this an accepted city name?
function isValidCity(name) {
  return PAKISTAN_CITIES.some(c => c.name === name);
}

module.exports = {
  PAKISTAN_CITIES,
  getCityNames,
  isValidCity
};
