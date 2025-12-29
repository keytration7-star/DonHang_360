/**
 * Hàm nhận diện tỉnh thành Việt Nam từ địa chỉ
 * Cải thiện độ chính xác với danh sách đầy đủ 63 tỉnh thành
 */

export function extractRegion(address: string): string {
  if (!address) return 'Không xác định';

  const addressLower = address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Loại bỏ dấu để so sánh

  // Danh sách đầy đủ 63 tỉnh thành Việt Nam (theo thứ tự ưu tiên - tỉnh thành lớn trước)
  const provinces = [
    // Thành phố trực thuộc Trung ương
    { name: 'Hà Nội', patterns: ['ha noi', 'hanoi', 'thành phố hà nội', 'tp hà nội', 'tp. hà nội'] },
    { name: 'Hồ Chí Minh', patterns: ['ho chi minh', 'hcm', 'sài gòn', 'saigon', 'thành phố hồ chí minh', 'tp hồ chí minh', 'tp. hồ chí minh', 'tp.hcm'] },
    { name: 'Đà Nẵng', patterns: ['da nang', 'danang', 'thành phố đà nẵng', 'tp đà nẵng', 'tp. đà nẵng'] },
    { name: 'Hải Phòng', patterns: ['hai phong', 'haiphong', 'thành phố hải phòng', 'tp hải phòng', 'tp. hải phòng'] },
    { name: 'Cần Thơ', patterns: ['can tho', 'cantho', 'thành phố cần thơ', 'tp cần thơ', 'tp. cần thơ'] },
    
    // Các tỉnh (theo thứ tự ABC)
    { name: 'An Giang', patterns: ['an giang'] },
    { name: 'Bà Rịa - Vũng Tàu', patterns: ['ba ria', 'vung tau', 'br-vt', 'brvt', 'bà rịa vũng tàu', 'bà rịa - vũng tàu'] },
    { name: 'Bắc Giang', patterns: ['bac giang'] },
    { name: 'Bắc Kạn', patterns: ['bac kan', 'bac can'] },
    { name: 'Bạc Liêu', patterns: ['bac lieu'] },
    { name: 'Bắc Ninh', patterns: ['bac ninh'] },
    { name: 'Bến Tre', patterns: ['ben tre'] },
    { name: 'Bình Định', patterns: ['binh dinh'] },
    { name: 'Bình Dương', patterns: ['binh duong'] },
    { name: 'Bình Phước', patterns: ['binh phuoc'] },
    { name: 'Bình Thuận', patterns: ['binh thuan'] },
    { name: 'Cà Mau', patterns: ['ca mau'] },
    { name: 'Cao Bằng', patterns: ['cao bang'] },
    { name: 'Đắk Lắk', patterns: ['dak lak', 'dac lac', 'đắk lắk', 'đắc lắc'] },
    { name: 'Đắk Nông', patterns: ['dak nong', 'dac nong', 'đắk nông', 'đắc nông'] },
    { name: 'Điện Biên', patterns: ['dien bien'] },
    { name: 'Đồng Nai', patterns: ['dong nai'] },
    { name: 'Đồng Tháp', patterns: ['dong thap'] },
    { name: 'Gia Lai', patterns: ['gia lai'] },
    { name: 'Hà Giang', patterns: ['ha giang'] },
    { name: 'Hà Nam', patterns: ['ha nam'] },
    { name: 'Hà Tĩnh', patterns: ['ha tinh'] },
    { name: 'Hải Dương', patterns: ['hai duong'] },
    { name: 'Hậu Giang', patterns: ['hau giang'] },
    { name: 'Hòa Bình', patterns: ['hoa binh'] },
    { name: 'Hưng Yên', patterns: ['hung yen'] },
    { name: 'Khánh Hòa', patterns: ['khanh hoa', 'nha trang'] },
    { name: 'Kiên Giang', patterns: ['kien giang', 'phu quoc'] },
    { name: 'Kon Tum', patterns: ['kon tum', 'kontum'] },
    { name: 'Lai Châu', patterns: ['lai chau'] },
    { name: 'Lâm Đồng', patterns: ['lam dong', 'da lat', 'dalat'] },
    { name: 'Lạng Sơn', patterns: ['lang son'] },
    { name: 'Lào Cai', patterns: ['lao cai'] },
    { name: 'Long An', patterns: ['long an'] },
    { name: 'Nam Định', patterns: ['nam dinh'] },
    { name: 'Nghệ An', patterns: ['nghe an', 'vinh'] },
    { name: 'Ninh Bình', patterns: ['ninh binh'] },
    { name: 'Ninh Thuận', patterns: ['ninh thuan'] },
    { name: 'Phú Thọ', patterns: ['phu tho'] },
    { name: 'Phú Yên', patterns: ['phu yen'] },
    { name: 'Quảng Bình', patterns: ['quang binh'] },
    { name: 'Quảng Nam', patterns: ['quang nam', 'hoi an', 'da nang'] },
    { name: 'Quảng Ngãi', patterns: ['quang ngai'] },
    { name: 'Quảng Ninh', patterns: ['quang ninh', 'ha long', 'halong'] },
    { name: 'Quảng Trị', patterns: ['quang tri'] },
    { name: 'Sóc Trăng', patterns: ['soc trang'] },
    { name: 'Sơn La', patterns: ['son la'] },
    { name: 'Tây Ninh', patterns: ['tay ninh'] },
    { name: 'Thái Bình', patterns: ['thai binh'] },
    { name: 'Thái Nguyên', patterns: ['thai nguyen'] },
    { name: 'Thanh Hóa', patterns: ['thanh hoa'] },
    { name: 'Thừa Thiên Huế', patterns: ['thua thien hue', 'hue', 'huế'] },
    { name: 'Tiền Giang', patterns: ['tien giang', 'my tho'] },
    { name: 'Trà Vinh', patterns: ['tra vinh'] },
    { name: 'Tuyên Quang', patterns: ['tuyen quang'] },
    { name: 'Vĩnh Long', patterns: ['vinh long'] },
    { name: 'Vĩnh Phúc', patterns: ['vinh phuc'] },
    { name: 'Yên Bái', patterns: ['yen bai'] },
  ];

  // Tìm kiếm theo thứ tự ưu tiên
  for (const province of provinces) {
    for (const pattern of province.patterns) {
      if (addressLower.includes(pattern)) {
        return province.name;
      }
    }
  }

  return 'Không xác định';
}

