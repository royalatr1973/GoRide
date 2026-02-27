/**
 * Local Chennai location database for autocomplete and geocoding
 * when external APIs (Nominatim/Google) are unreachable.
 */
const locations = [
  { name: 'Chennai Central Railway Station', area: 'Park Town', lat: 13.0827, lng: 80.2707, aliases: ['central', 'railway station', 'park town'] },
  { name: 'Chennai Egmore Railway Station', area: 'Egmore', lat: 13.0732, lng: 80.2609, aliases: ['egmore', 'egmore station'] },
  { name: 'Chennai Airport (MAA)', area: 'Tirusulam', lat: 12.9941, lng: 80.1709, aliases: ['airport', 'maa', 'meenambakkam', 'tirusulam'] },
  { name: 'T. Nagar', area: 'T. Nagar', lat: 13.0418, lng: 80.2341, aliases: ['t nagar', 'tnagar', 'thyagaraya nagar', 'pondy bazaar', 'ranganathan street'] },
  { name: 'Anna Nagar', area: 'Anna Nagar', lat: 13.0850, lng: 80.2101, aliases: ['anna nagar', 'annanagar'] },
  { name: 'Adyar', area: 'Adyar', lat: 13.0063, lng: 80.2574, aliases: ['adyar'] },
  { name: 'Velachery', area: 'Velachery', lat: 12.9815, lng: 80.2180, aliases: ['velachery'] },
  { name: 'Tambaram', area: 'Tambaram', lat: 12.9249, lng: 80.1000, aliases: ['tambaram'] },
  { name: 'Guindy', area: 'Guindy', lat: 13.0067, lng: 80.2206, aliases: ['guindy', 'guindy industrial estate'] },
  { name: 'Mylapore', area: 'Mylapore', lat: 13.0368, lng: 80.2676, aliases: ['mylapore', 'kapaleeshwarar temple'] },
  { name: 'Marina Beach', area: 'Marina', lat: 13.0500, lng: 80.2824, aliases: ['marina', 'marina beach', 'beach'] },
  { name: 'Besant Nagar', area: 'Besant Nagar', lat: 13.0002, lng: 80.2668, aliases: ['besant nagar', 'besantnagar', 'elliot beach', 'elliots beach'] },
  { name: 'Nungambakkam', area: 'Nungambakkam', lat: 13.0569, lng: 80.2425, aliases: ['nungambakkam'] },
  { name: 'Kodambakkam', area: 'Kodambakkam', lat: 13.0520, lng: 80.2244, aliases: ['kodambakkam'] },
  { name: 'Chromepet', area: 'Chromepet', lat: 12.9516, lng: 80.1462, aliases: ['chromepet', 'chrompet'] },
  { name: 'Porur', area: 'Porur', lat: 13.0382, lng: 80.1565, aliases: ['porur'] },
  { name: 'Sholinganallur', area: 'Sholinganallur', lat: 12.9010, lng: 80.2279, aliases: ['sholinganallur', 'shollinganallur'] },
  { name: 'OMR (Old Mahabalipuram Road)', area: 'OMR', lat: 12.9165, lng: 80.2274, aliases: ['omr', 'old mahabalipuram road', 'it corridor'] },
  { name: 'ECR (East Coast Road)', area: 'ECR', lat: 12.9600, lng: 80.2500, aliases: ['ecr', 'east coast road'] },
  { name: 'Thiruvanmiyur', area: 'Thiruvanmiyur', lat: 12.9830, lng: 80.2594, aliases: ['thiruvanmiyur'] },
  { name: 'Palavakkam', area: 'Palavakkam', lat: 12.9572, lng: 80.2581, aliases: ['palavakkam'] },
  { name: 'Vadapalani', area: 'Vadapalani', lat: 13.0526, lng: 80.2121, aliases: ['vadapalani', 'vadapalani murugan temple'] },
  { name: 'Ashok Nagar', area: 'Ashok Nagar', lat: 13.0380, lng: 80.2116, aliases: ['ashok nagar', 'ashoknagar'] },
  { name: 'Teynampet', area: 'Teynampet', lat: 13.0447, lng: 80.2520, aliases: ['teynampet'] },
  { name: 'Royapettah', area: 'Royapettah', lat: 13.0543, lng: 80.2631, aliases: ['royapettah'] },
  { name: 'Mount Road', area: 'Anna Salai', lat: 13.0604, lng: 80.2621, aliases: ['mount road', 'anna salai'] },
  { name: 'Spencer Plaza', area: 'Anna Salai', lat: 13.0620, lng: 80.2630, aliases: ['spencer', 'spencer plaza'] },
  { name: 'Phoenix MarketCity', area: 'Velachery', lat: 12.9925, lng: 80.2193, aliases: ['phoenix', 'phoenix mall', 'phoenix market city', 'marketcity'] },
  { name: 'Express Avenue Mall', area: 'Royapettah', lat: 13.0596, lng: 80.2647, aliases: ['express avenue', 'ea mall'] },
  { name: 'Forum Vijaya Mall', area: 'Vadapalani', lat: 13.0500, lng: 80.2117, aliases: ['forum vijaya', 'forum mall'] },
  { name: 'Sathyam Cinemas', area: 'Royapettah', lat: 13.0558, lng: 80.2606, aliases: ['sathyam', 'sathyam cinemas'] },
  { name: 'Koyambedu Bus Terminus', area: 'Koyambedu', lat: 13.0694, lng: 80.1948, aliases: ['koyambedu', 'cmbt', 'bus stand', 'bus terminus'] },
  { name: 'Perambur', area: 'Perambur', lat: 13.1119, lng: 80.2330, aliases: ['perambur'] },
  { name: 'Ambattur', area: 'Ambattur', lat: 13.1143, lng: 80.1548, aliases: ['ambattur', 'ambattur industrial estate'] },
  { name: 'Avadi', area: 'Avadi', lat: 13.1143, lng: 80.1010, aliases: ['avadi'] },
  { name: 'Pallavaram', area: 'Pallavaram', lat: 12.9675, lng: 80.1491, aliases: ['pallavaram'] },
  { name: 'IIT Madras', area: 'Adyar', lat: 12.9916, lng: 80.2336, aliases: ['iit', 'iit madras', 'iitm'] },
  { name: 'Anna University', area: 'Guindy', lat: 13.0108, lng: 80.2354, aliases: ['anna university'] },
  { name: 'Loyola College', area: 'Nungambakkam', lat: 13.0585, lng: 80.2379, aliases: ['loyola', 'loyola college'] },
  { name: 'Madras University', area: 'Marina', lat: 13.0591, lng: 80.2783, aliases: ['madras university'] },
  { name: 'Apollo Hospital', area: 'Greams Road', lat: 13.0566, lng: 80.2522, aliases: ['apollo', 'apollo hospital'] },
  { name: 'MIOT Hospital', area: 'Manapakkam', lat: 13.0248, lng: 80.1671, aliases: ['miot', 'miot hospital'] },
  { name: 'Fortis Malar Hospital', area: 'Adyar', lat: 13.0105, lng: 80.2565, aliases: ['fortis', 'fortis malar', 'malar hospital'] },
  { name: 'Tidel Park', area: 'Taramani', lat: 12.9862, lng: 80.2444, aliases: ['tidel', 'tidel park', 'taramani'] },
  { name: 'DLF IT Park', area: 'Manapakkam', lat: 13.0257, lng: 80.1690, aliases: ['dlf', 'dlf it park'] },
  { name: 'Siruseri IT Park', area: 'Siruseri', lat: 12.8231, lng: 80.2200, aliases: ['siruseri', 'sipcot'] },
  { name: 'Mahabalipuram', area: 'Mahabalipuram', lat: 12.6269, lng: 80.1927, aliases: ['mahabalipuram', 'mamallapuram'] },
  { name: 'Kelambakkam', area: 'Kelambakkam', lat: 12.7864, lng: 80.2199, aliases: ['kelambakkam'] },
  { name: 'Medavakkam', area: 'Medavakkam', lat: 12.9198, lng: 80.1927, aliases: ['medavakkam'] },
  { name: 'Thoraipakkam', area: 'Thoraipakkam', lat: 12.9319, lng: 80.2322, aliases: ['thoraipakkam'] },
  { name: 'Perungudi', area: 'Perungudi', lat: 12.9582, lng: 80.2375, aliases: ['perungudi'] },
  { name: 'Madhya Kailash', area: 'Adyar', lat: 12.9952, lng: 80.2490, aliases: ['madhya kailash'] },
  { name: 'Saidapet', area: 'Saidapet', lat: 13.0213, lng: 80.2245, aliases: ['saidapet'] },
  { name: 'West Mambalam', area: 'West Mambalam', lat: 13.0387, lng: 80.2213, aliases: ['west mambalam', 'mambalam'] },
  { name: 'Alwarpet', area: 'Alwarpet', lat: 13.0335, lng: 80.2560, aliases: ['alwarpet'] },
  { name: 'Raja Annamalai Puram (RA Puram)', area: 'RA Puram', lat: 13.0300, lng: 80.2628, aliases: ['ra puram', 'raja annamalai puram'] },
  { name: 'Chetpet', area: 'Chetpet', lat: 13.0718, lng: 80.2447, aliases: ['chetpet'] },
  { name: 'Kilpauk', area: 'Kilpauk', lat: 13.0791, lng: 80.2423, aliases: ['kilpauk'] },
  { name: 'Sowcarpet', area: 'Sowcarpet', lat: 13.0944, lng: 80.2803, aliases: ['sowcarpet'] },
  { name: 'George Town', area: 'George Town', lat: 13.0900, lng: 80.2850, aliases: ['george town', 'georgetown'] },
  { name: 'Purasawalkam', area: 'Purasawalkam', lat: 13.0897, lng: 80.2540, aliases: ['purasawalkam', 'purasaiwalkam'] },
];

function searchLocations(query) {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  return locations
    .map((loc) => {
      const nameMatch = loc.name.toLowerCase().includes(q);
      const areaMatch = loc.area.toLowerCase().includes(q);
      const aliasMatch = loc.aliases.some((a) => a.includes(q));
      const exactAlias = loc.aliases.some((a) => a === q);

      if (!nameMatch && !areaMatch && !aliasMatch) return null;

      // Score: exact alias > name starts with > alias match > name contains > area match
      let score = 0;
      if (exactAlias) score = 100;
      else if (loc.name.toLowerCase().startsWith(q)) score = 90;
      else if (aliasMatch) score = 70;
      else if (nameMatch) score = 50;
      else if (areaMatch) score = 30;

      return { ...loc, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function geocodeLocal(query) {
  const results = searchLocations(query);
  return results.length > 0 ? results[0] : null;
}

module.exports = { locations, searchLocations, geocodeLocal };
