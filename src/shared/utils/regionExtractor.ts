/**
 * Hàm nhận diện tỉnh thành Việt Nam từ địa chỉ
 * Cải thiện độ chính xác với danh sách đầy đủ 63 tỉnh thành
 */

import { logger } from './logger';

export function extractRegion(address: string): string {
  if (!address) return 'Không xác định';

  // Chuẩn hóa địa chỉ: loại bỏ dấu và chuyển thành chữ thường
  const addressNormalized = address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Tìm vị trí dấu phẩy cuối cùng trong địa chỉ gốc (trước khi normalize)
  const lastCommaIndex = address.lastIndexOf(',');

  // Danh sách 34 tỉnh thành Việt Nam SAU SÁP NHẬP 2025 (theo thứ tự ưu tiên - tỉnh thành lớn trước)
  // Sau sáp nhập 2025: Giảm từ 63 xuống 34 tỉnh/thành phố
  // Cấp hành chính mới: Chỉ còn 2 cấp - Tỉnh/Thành phố và Phường/Xã (bỏ cấp Huyện)
  // Bao gồm các biến thể: tên đầy đủ, tên viết tắt, tên cũ (trước sáp nhập), tên không dấu, tên thành phố/huyện trực thuộc
  // QUAN TRỌNG: Các tỉnh đã sáp nhập cần có patterns từ CẢ các tỉnh cũ để nhận diện địa chỉ cũ
  const provinces = [
    // Thành phố trực thuộc Trung ương (6 thành phố sau sáp nhập)
    // 1. Hà Nội - Giữ nguyên
    { name: 'Hà Nội', patterns: ['ha noi', 'hanoi', 'thành phố hà nội', 'tp hà nội', 'tp. hà nội', 'tp.ha noi', 'tphn', 'hn', 'hà nội', 'thanh pho ha noi', 'ha noi city', 'hanoi city', 'thủ đô', 'thu do', 'hoàn kiếm', 'hoan kiem', 'ba đình', 'ba dinh', 'đống đa', 'dong da', 'hai bà trưng', 'hai ba trung', 'tây hồ', 'tay ho', 'cầu giấy', 'cau giay', 'thanh xuân', 'thanh xuan', 'hoàng mai', 'hoang mai', 'long biên', 'long bien'] },
    
    // 2. Hồ Chí Minh - Sáp nhập Bình Dương, TP.HCM và Bà Rịa - Vũng Tàu
    { name: 'Hồ Chí Minh', patterns: ['ho chi minh', 'hcm', 'sài gòn', 'saigon', 'thành phố hồ chí minh', 'tp hồ chí minh', 'tp. hồ chí minh', 'tp.hcm', 'tphcm', 'sg', 'sai gon', 'hồ chí minh', 'thanh pho ho chi minh', 'tphcm', 'hcm city', 'quận 1', 'quan 1', 'quận 2', 'quan 2', 'quận 3', 'quan 3', 'quận 4', 'quan 4', 'quận 5', 'quan 5', 'quận 6', 'quan 6', 'quận 7', 'quan 7', 'quận 8', 'quan 8', 'quận 9', 'quan 9', 'quận 10', 'quan 10', 'quận 11', 'quan 11', 'quận 12', 'quan 12', 'bình thạnh', 'binh thanh', 'tân bình', 'tan binh', 'tân phú', 'tan phu', 'phú nhuận', 'phu nhuan', 'gò vấp', 'go vap', 'bình tân', 'binh tan', 'thủ đức', 'thu duc', 
      // Patterns từ Bình Dương (đã sáp nhập)
      'binh duong', 'bình dương', 'thu dau mot', 'thủ dầu một', 'dĩ an', 'tân uyên', 'dầu tiếng', 'bến cát', 'bàu bàng', 'phú giáo',
      // Patterns từ Bà Rịa - Vũng Tàu (đã sáp nhập)
      'ba ria', 'vung tau', 'bà rịa', 'vũng tàu', 'br-vt', 'brvt', 'baria', 'vungtau', 'châu đức', 'côn đảo', 'đất đỏ', 'long điền', 'tân thành', 'xuyên mộc'] },
    
    // 3. Hải Phòng - Sáp nhập Hải Phòng và Hải Dương
    { name: 'Hải Phòng', patterns: ['hai phong', 'haiphong', 'thành phố hải phòng', 'tp hải phòng', 'tp. hải phòng', 'tp.hai phong', 'tphp', 'hp', 'hải phòng', 'thanh pho hai phong', 'hai phong city', 'hồng bàng', 'hong bang', 'ngô quyền', 'ngo quyen', 'lê chân', 'le chan', 'hải an', 'hai an', 'kiến an', 'kien an', 'đồ sơn', 'do son', 'duyên hải', 'duyen hai', 'thủy nguyên', 'thuy nguyen', 'an dương', 'an duong', 'an lão', 'an lao', 'kiến thụy', 'kien thuy', 'tiên lãng', 'tien lang', 'vĩnh bảo', 'vinh bao', 'cát hải', 'cat hai', 'bạch long vĩ', 'bach long vi',
      // Patterns từ Hải Dương (đã sáp nhập)
      'hai duong', 'hải dương', 'bình giang', 'cẩm giàng', 'gia lộc', 'kim thành', 'kinh môn', 'nam sách', 'ninh giang', 'thanh hà', 'thanh miện', 'tứ kỳ'] },
    
    // 4. Đà Nẵng - Sáp nhập Đà Nẵng và Quảng Nam
    { name: 'Đà Nẵng', patterns: ['da nang', 'danang', 'thành phố đà nẵng', 'tp đà nẵng', 'tp. đà nẵng', 'tp.da nang', 'tpdn', 'dn', 'đà nẵng', 'thanh pho da nang', 'da nang city', 'hải châu', 'hai chau', 'thanh khê', 'thanh khe', 'sơn trà', 'son tra', 'ngũ hành sơn', 'ngu hanh son', 'liên chiểu', 'lien chieu', 'cẩm lệ', 'cam le', 'hòa vang', 'hoa vang', 'hoàng sa', 'hoang sa',
      // Patterns từ Quảng Nam (đã sáp nhập)
      'quang nam', 'quảng nam', 'hoi an', 'hội an', 'tam ky', 'tam kỳ', 'bắc trà my', 'đại lộc', 'điện bàn', 'đông giang', 'duy xuyên', 'hiệp đức', 'nam giang', 'phước sơn', 'phú ninh', 'tây giang', 'thăng bình', 'tiên phước', 'nam trà my'] },
    
    // 5. Huế - Giữ nguyên (thành phố mới)
    { name: 'Thừa Thiên Huế', patterns: ['thua thien hue', 'thuathienhue', 'thừa thiên huế', 'hue', 'huế', 'hue city', 'huế', 'thành phố huế', 'tp huế', 'a lưới', 'hương điền', 'hương thủy', 'hương trà', 'nam đông', 'phong điền', 'phú lộc', 'phú vang', 'quảng điền'] },
    
    // 6. Cần Thơ - Sáp nhập Cần Thơ, Sóc Trăng và Hậu Giang
    { name: 'Cần Thơ', patterns: ['can tho', 'cantho', 'thành phố cần thơ', 'tp cần thơ', 'tp. cần thơ', 'tp.can tho', 'tpct', 'ct', 'cần thơ', 'thanh pho can tho', 'can tho city', 'ninh kiều', 'ninh kieu', 'ô môn', 'o mon', 'bình thủy', 'binh thuy', 'cái răng', 'cai rang', 'thốt nốt', 'thot not', 'vĩnh thạnh', 'vinh thanh', 'cờ đỏ', 'co do', 'phong điền', 'phong dien', 'thới lai', 'thoi lai',
      // Patterns từ Sóc Trăng (đã sáp nhập)
      'soc trang', 'sóc trăng', 'châu thành', 'cù lao dung', 'kế sách', 'long phú', 'mỹ tú', 'mỹ xuyên', 'ngã năm', 'thạnh trị', 'trần đề', 'vĩnh châu',
      // Patterns từ Hậu Giang (đã sáp nhập)
      'hau giang', 'hậu giang', 'vi thanh', 'vị thanh', 'bình minh', 'châu thành', 'long mỹ', 'ngã bảy', 'phụng hiệp', 'vị thủy'] },
    
    // Các tỉnh (28 tỉnh sau sáp nhập) - theo thứ tự ABC với patterns từ cả tỉnh cũ và mới
    // 7. An Giang - Sáp nhập An Giang và Kiên Giang
    { name: 'An Giang', patterns: ['an giang', 'angiang', 'long xuyen', 'longxuyen', 'chau doc', 'chaudoc', 'châu đốc', 'an phú', 'an phu', 'châu phú', 'chau phu', 'châu thành', 'chau thanh', 'chợ mới', 'cho moi', 'phú tân', 'phu tan', 'tân châu', 'tan chau', 'thoại sơn', 'thoai son', 'tri tôn', 'tri ton',
      // Patterns từ Kiên Giang (đã sáp nhập)
      'kien giang', 'kiên giang', 'phu quoc', 'phú quốc', 'rach gia', 'rạch giá', 'an biên', 'an minh', 'châu thành', 'giồng riềng', 'gò quao', 'hà tiên', 'hòn đất', 'kiên hài', 'kiên lương', 'tân hiệp', 'u minh thượng', 'vĩnh thuận'] },
    // 8. Bắc Ninh - Sáp nhập Bắc Ninh và Bắc Giang
    { name: 'Bắc Ninh', patterns: ['bac ninh', 'bacninh', 'bắc ninh', 'yen phong', 'yên phong', 'quế võ', 'tiên du', 'từ sơn', 'gia bình', 'lương tài', 'thuận thành',
      // Patterns từ Bắc Giang (đã sáp nhập)
      'bac giang', 'bắc giang', 'yên thế', 'tân yên', 'lạng giang', 'lục nam', 'lục ngạn', 'sơn động', 'yên dũng', 'việt yên', 'hiệp hòa'] },
    // 9. Vĩnh Long - Sáp nhập Vĩnh Long, Bến Tre và Trà Vinh
    { name: 'Vĩnh Long', patterns: ['vinh long', 'vinhlong', 'vinh long', 'bình minh', 'long hồ', 'mang thít', 'tam bình', 'trà ôn', 'vũng liêm',
      // Patterns từ Bến Tre (đã sáp nhập)
      'ben tre', 'bến tre', 'châu thành', 'chợ lách', 'mỏ cày bắc', 'mỏ cày nam', 'giồng trôm', 'bình đại', 'ba tri', 'thạnh phú',
      // Patterns từ Trà Vinh (đã sáp nhập)
      'tra vinh', 'trà vinh', 'càng long', 'cầu kè', 'cầu ngang', 'châu thành', 'duyên hải', 'tiểu cần', 'trà cú'] },
    // 10. Cà Mau - Sáp nhập Cà Mau và Bạc Liêu
    { name: 'Cà Mau', patterns: ['ca mau', 'camau', 'cà mau', 'cái nước', 'đầm dơi', 'năm căn', 'ngọc hiển', 'phú tân', 'thới bình', 'trần văn thời', 'u minh',
      // Patterns từ Bạc Liêu (đã sáp nhập)
      'bac lieu', 'bạc liêu', 'hồng dân', 'phước long', 'vĩnh lợi', 'giá rai', 'đông hải', 'hoà bình', 'nhà mát'] },
    // 11. Cao Bằng - Giữ nguyên
    { name: 'Cao Bằng', patterns: ['cao bang', 'caobang', 'cao bằng', 'bảo lạc', 'bảo lâm', 'hạ lang', 'hà quảng', 'hoà an', 'nguyên bình', 'quảng uyên', 'thạch an', 'trùng khánh', 'trấn lạc'] },
    // 12. Đắk Lắk - Sáp nhập Đắk Lắk và Phú Yên
    { name: 'Đắk Lắk', patterns: ['dak lak', 'dac lac', 'đắk lắk', 'đắc lắc', 'daklak', 'daclac', 'buon ma thuot', 'buôn ma thuột', 'buôn hồ', 'cư kuin', 'cư m gar', 'ea h leo', 'ea kar', 'ea súp', 'krông a na', 'krông bông', 'krông buk', 'krông năng', 'lắk', 'm đrắk',
      // Patterns từ Phú Yên (đã sáp nhập)
      'phu yen', 'phú yên', 'tuy hoa', 'tuy hòa', 'sông cầu', 'đông hòa', 'phú hòa', 'sơn hòa', 'sông hinh', 'tây hòa', 'tuy an'] },
    // 13. Điện Biên - Giữ nguyên
    { name: 'Điện Biên', patterns: ['dien bien', 'dienbien', 'điện biên', 'dien bien phu', 'điện biên phủ', 'mường lay', 'mường ảng', 'mường chà', 'mường nhé', 'mường tè', 'nậm pồ', 'tủa chùa', 'tuần giáo', 'điện biên đông'] },
    
    // 14. Đồng Nai - Sáp nhập Đồng Nai và Bình Phước
    { name: 'Đồng Nai', patterns: ['dong nai', 'dongnai', 'đồng nai', 'bien hoa', 'biên hòa', 'cẩm mỹ', 'định quán', 'long khánh', 'long thành', 'nhơn trạch', 'tân phú', 'vĩnh cửu', 'xuân lộc', 'thống nhất',
      // Patterns từ Bình Phước (đã sáp nhập)
      'binh phuoc', 'bình phước', 'dong xoai', 'đồng xoài', 'bình long', 'bù đăng', 'bù đốp', 'bù gia mập', 'chơn thành', 'đồng phú', 'hớn quản', 'lộc ninh'] },
    
    // 15. Đồng Tháp - Sáp nhập Đồng Tháp và Tiền Giang
    { name: 'Đồng Tháp', patterns: ['dong thap', 'dongthap', 'đồng tháp', 'cao lanh', 'cao lãnh', 'sa đéc', 'tân hồng', 'tân hưng', 'tam nông', 'thanh bình', 'tháp mười', 'lấp vò', 'lai vung', 'châu thành', 'hồng ngự',
      // Patterns từ Tiền Giang (đã sáp nhập)
      'tien giang', 'tiền giang', 'my tho', 'mỹ tho', 'cái bè', 'cai lớn', 'châu thành', 'chợ gạo', 'gò công', 'gò công đông', 'gò công tây', 'tân phú đông', 'tân phước'] },
    // 16. Gia Lai - Sáp nhập Gia Lai và Kon Tum
    { name: 'Gia Lai', patterns: ['gia lai', 'gialai', 'gia lai', 'pleiku', 'plei ku', 'an khê', 'ayun pa', 'chư prông', 'chư sê', 'đăk đoa', 'đăk pơ', 'đức cơ', 'ia grai', 'ia pa', 'kbang', 'kông chro', 'krông pa', 'mang yang', 'phú thiện',
      // Patterns từ Kon Tum (đã sáp nhập)
      'kon tum', 'kon tum', 'đắk glei', 'đắk hà', 'đắk tô', 'ia h drai', 'kon plông', 'kon rẫy', 'ngọc hồi', 'sa thầy', 'tu mơ rông'] },
    
    // 17. Hà Nam - Sáp nhập Hà Nam, Nam Định và Ninh Bình
    { name: 'Hà Nam', patterns: ['ha nam', 'hanam', 'hà nam', 'phu ly', 'phủ lý', 'bình lục', 'duy tiên', 'kim bảng', 'lý nhân', 'thanh liêm',
      // Patterns từ Nam Định (đã sáp nhập)
      'nam dinh', 'nam định', 'mỹ lộc', 'vụ bản', 'ý yên', 'nghĩa hưng', 'nam trực', 'trực ninh', 'xuân trường', 'giao thủy', 'hải hậu',
      // Patterns từ Ninh Bình (đã sáp nhập)
      'ninh binh', 'ninh bình', 'kim sơn', 'yên khánh', 'yên mô', 'hoa lư', 'gia viễn', 'nho quan'] },
    // 18. Hà Tĩnh - Giữ nguyên
    { name: 'Hà Tĩnh', patterns: ['ha tinh', 'hatinh', 'hà tĩnh', 'can lộc', 'cẩm xuyên', 'đức thọ', 'hương khê', 'hương sơn', 'kỳ anh', 'lộc hà', 'nghi xuân', 'thạch hà', 'vũ quang'] },
    
    // 19. Hưng Yên - Sáp nhập Hưng Yên và Thái Bình
    { name: 'Hưng Yên', patterns: ['hung yen', 'hungyen', 'hưng yên', 'mỹ hào', 'ân thi', 'khoái châu', 'kim động', 'phù cừ', 'tiên lữ', 'văn giang', 'văn lâm', 'yên mỹ',
      // Patterns từ Thái Bình (đã sáp nhập)
      'thai binh', 'thái bình', 'đông hưng', 'hưng hà', 'kiến xương', 'quỳnh phụ', 'thái thụy', 'tiền hải', 'vũ thư'] },
    
    // 20. Khánh Hòa - Sáp nhập Khánh Hòa và Ninh Thuận
    { name: 'Khánh Hòa', patterns: ['khanh hoa', 'khanhhoa', 'khánh hòa', 'nha trang', 'nha trang', 'cam ranh', 'cam ranh', 'cam lâm', 'diên khánh', 'khánh sơn', 'khánh vĩnh', 'ninh hòa', 'trường sa', 'vạn ninh',
      // Patterns từ Ninh Thuận (đã sáp nhập)
      'ninh thuan', 'ninh thuận', 'phan rang', 'phan rang - tháp chàm', 'bác ái', 'ninh hải', 'ninh phước', 'ninh sơn', 'thuận bắc', 'thuận nam'] },
    
    // 21. Lai Châu - Giữ nguyên
    { name: 'Lai Châu', patterns: ['lai chau', 'laichau', 'lai châu', 'mường tè', 'nậm nhùn', 'phong thổ', 'sìn hồ', 'tam đường', 'tân uyên', 'than uyên'] },
    
    // 22. Lâm Đồng - Sáp nhập Lâm Đồng, Bình Thuận và Đắk Nông
    { name: 'Lâm Đồng', patterns: ['lam dong', 'lamdong', 'lâm đồng', 'da lat', 'đà lạt', 'bao loc', 'bảo lộc', 'bảo lâm', 'cát tiên', 'đạ huoai', 'đạ tẻh', 'đam rông', 'đơn dương', 'đức trọng', 'lạc dương', 'lâm hà',
      // Patterns từ Bình Thuận (đã sáp nhập)
      'binh thuan', 'bình thuận', 'phan thiet', 'phan thiết', 'mui ne', 'mũi né', 'la gi', 'tuy phong', 'bắc bình', 'hàm tân', 'hàm thuận bắc', 'hàm thuận nam', 'phú quí', 'tánh linh', 'đức linh',
      // Patterns từ Đắk Nông (đã sáp nhập)
      'dak nong', 'đắk nông', 'gia nghia', 'gia nghĩa', 'cư jút', 'đắk glong', 'đắk mil', 'đắk r lấp', 'đắk song', 'krông nô', 'tuy đức'] },
    // 23. Lạng Sơn - Giữ nguyên
    { name: 'Lạng Sơn', patterns: ['lang son', 'langson', 'lạng sơn', 'bắc sơn', 'bình gia', 'cao lộc', 'chi lăng', 'đình lập', 'hữu lũng', 'lộc bình', 'tràng định', 'văn lãng', 'văn quan'] },
    
    // 24. Lào Cai - Sáp nhập Lào Cai và Yên Bái
    { name: 'Lào Cai', patterns: ['lao cai', 'laocai', 'lào cai', 'sapa', 'sa pa', 'bảo thắng', 'bảo yên', 'bát xát', 'mường khương', 'si ma cai', 'văn bàn',
      // Patterns từ Yên Bái (đã sáp nhập)
      'yen bai', 'yên bái', 'lục yên', 'mù cang chải', 'nghĩa lộ', 'trạm tấu', 'trấn yên', 'văn chấn', 'văn yên', 'yên bình'] },
    
    // 25. Tây Ninh - Sáp nhập Tây Ninh và Long An
    { name: 'Tây Ninh', patterns: ['tay ninh', 'tayninh', 'tây ninh', 'bến cầu', 'châu thành', 'dương minh châu', 'gò dầu', 'hòa thành', 'tân biên', 'tân châu', 'trảng bàng',
      // Patterns từ Long An (đã sáp nhập)
      'long an', 'long an', 'tan an', 'tân an', 'bến lức', 'cần đước', 'cần giuộc', 'châu thành', 'đức hòa', 'đức huệ', 'mộc hóa', 'tân hưng', 'tân thạnh', 'tân trụ', 'thạnh hóa', 'thủ thừa', 'vĩnh hưng'] },
    
    // 26. Nghệ An - Giữ nguyên
    { name: 'Nghệ An', patterns: ['nghe an', 'nghean', 'nghệ an', 'vinh', 'vinh city', 'anh sơn', 'con cuông', 'diễn châu', 'đô lương', 'hưng nguyên', 'kỳ sơn', 'nam đàn', 'nghi lộc', 'nghĩa đàn', 'quế phong', 'quỳ châu', 'quỳ hợp', 'quỳnh lưu', 'tân kỳ', 'thanh chương', 'tương dương', 'yên thành'] },
    
    // 27. Phú Thọ - Sáp nhập Phú Thọ, Hòa Bình và Vĩnh Phúc
    { name: 'Phú Thọ', patterns: ['phu tho', 'phutho', 'phú thọ', 'viet tri', 'việt trì', 'cẩm khê', 'đoan hùng', 'hạ hòa', 'lâm thao', 'phù ninh', 'tam nông', 'tân sơn', 'thanh ba', 'thanh sơn', 'thanh thủy', 'yên lập',
      // Patterns từ Hòa Bình (đã sáp nhập)
      'hoa binh', 'hòa bình', 'đà bắc', 'kim bôi', 'cao phong', 'lạc sơn', 'lạc thủy', 'lương sơn', 'mai châu', 'tân lạc', 'yên thủy',
      // Patterns từ Vĩnh Phúc (đã sáp nhập)
      'vinh phuc', 'vinh phúc', 'vinh yen', 'vĩnh yên', 'bình xuyên', 'lập thạch', 'phúc yên', 'sông lô', 'tam đảo', 'tam dương', 'vĩnh tường', 'yên lạc'] },
    // 28. Quảng Ngãi - Sáp nhập Quảng Ngãi và Bình Định
    { name: 'Quảng Ngãi', patterns: ['quang ngai', 'quangngai', 'quảng ngãi', 'ba tơ', 'bình sơn', 'đức phổ', 'lý sơn', 'minh long', 'mộ đức', 'nghĩa hành', 'sơn hà', 'sơn tịnh', 'sơn tây', 'tây trà', 'trà bồng', 'tư nghĩa',
      // Patterns từ Bình Định (đã sáp nhập)
      'binh dinh', 'bình định', 'quy nhon', 'quy nhơn', 'an lao', 'hoài ân', 'hoài nhơn', 'phù cát', 'phù mỹ', 'tây sơn', 'tuy phước', 'vân canh', 'vĩnh thạnh'] },
    // 29. Quảng Ninh - Giữ nguyên
    { name: 'Quảng Ninh', patterns: ['quang ninh', 'quangninh', 'quảng ninh', 'ha long', 'hạ long', 'cam pha', 'cẩm phả', 'mong cai', 'móng cái', 'cô to', 'đầm hà', 'đông triều', 'hải hà', 'hoành bồ', 'quảng yên', 'tiên yên', 'vân đồn', 'bình liêu'] },
    
    // 30. Quảng Trị - Sáp nhập Quảng Trị và Quảng Bình
    { name: 'Quảng Trị', patterns: ['quang tri', 'quangtri', 'quảng trị', 'dong ha', 'đông hà', 'cam lộ', 'cồn cỏ', 'đa krông', 'gio linh', 'hải lăng', 'hướng hóa', 'triệu phong', 'vĩnh linh',
      // Patterns từ Quảng Bình (đã sáp nhập)
      'quang binh', 'quảng bình', 'dong hoi', 'đồng hới', 'bố trạch', 'lệ thủy', 'minh hóa', 'quảng ninh', 'quảng trạch', 'tuyên hóa'] },
    
    // 31. Sơn La - Giữ nguyên
    { name: 'Sơn La', patterns: ['son la', 'sonla', 'sơn la', 'mường la', 'mai sơn', 'mộc châu', 'mường ảng', 'mường khương', 'phù yên', 'quỳnh nhai', 'sông mã', 'sốp cộp', 'thuận châu', 'vân hồ', 'yên châu'] },
    
    // 32. Thái Nguyên - Sáp nhập Thái Nguyên và Bắc Kạn
    { name: 'Thái Nguyên', patterns: ['thai nguyen', 'thainguyen', 'thái nguyên', 'đại từ', 'định hóa', 'đồng hỷ', 'phú bình', 'phú lương', 'sông công', 'võ nhai',
      // Patterns từ Bắc Kạn (đã sáp nhập)
      'bac kan', 'bắc kạn', 'bắc cạn', 'ba bể', 'bạch thông', 'chợ đón', 'chợ mới', 'na rì', 'ngân sơn', 'pác nặm', 'bảo lạc'] },
    // 33. Thanh Hóa - Giữ nguyên
    { name: 'Thanh Hóa', patterns: ['thanh hoa', 'thanhhoa', 'thanh hóa', 'bỉm sơn', 'sầm sơn', 'bá thước', 'cẩm thủy', 'đông sơn', 'hà trung', 'hậu lộc', 'hoằng hóa', 'lang chánh', 'mường lát', 'nga sơn', 'ngọc lặc', 'như thanh', 'như xuân', 'nông cống', 'quan hóa', 'quan sơn', 'quảng xương', 'tĩnh gia', 'thiệu hóa', 'thọ xuân', 'thường xuân', 'triệu sơn', 'vĩnh lộc', 'yên định'] },
    
    // 34. Tuyên Quang - Sáp nhập Tuyên Quang và Hà Giang
    { name: 'Tuyên Quang', patterns: ['tuyen quang', 'tuyenquang', 'tuyên quang', 'chiêm hóa', 'hàm yên', 'lâm bình', 'na hang', 'sơn dương', 'yên sơn',
      // Patterns từ Hà Giang (đã sáp nhập)
      'ha giang', 'hà giang', 'bắc mê', 'bắc quang', 'đồng văn', 'hoàng su phì', 'mèo vạc', 'mù cang chải', 'quản bạ', 'quang bình', 'vị xuyên', 'xín mần', 'yên minh'] },
  ];

  // Tìm kiếm theo thứ tự ưu tiên
  // Ưu tiên 1: Tìm trong phần sau dấu phẩy cuối cùng (tỉnh/thành phố)
  if (lastCommaIndex !== -1) {
    // Lấy phần sau dấu phẩy cuối cùng từ địa chỉ gốc
    const lastPartOriginal = address.substring(lastCommaIndex + 1).trim();
    const lastPart = lastPartOriginal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const lastPartWithAccent = lastPartOriginal.toLowerCase();
    
    // Tìm kiếm trong phần cuối này - ưu tiên tìm tên tỉnh thành trước
    for (const province of provinces) {
      // Kiểm tra tên tỉnh thành trực tiếp (có dấu)
      const provinceNameLower = province.name.toLowerCase();
      const provinceNameNoAccent = provinceNameLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // Kiểm tra exact match hoặc contains trong phần cuối
      if (lastPartWithAccent === provinceNameLower || 
          lastPart === provinceNameNoAccent ||
          lastPartWithAccent.includes(provinceNameLower) || 
          lastPart.includes(provinceNameNoAccent)) {
        return province.name;
      }
      
      // Kiểm tra các pattern
      for (const pattern of province.patterns) {
        const patternNoAccent = pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Kiểm tra exact match hoặc contains
        if (lastPart === pattern || 
            lastPart === patternNoAccent ||
            lastPart.includes(pattern) || 
            lastPart.includes(patternNoAccent) ||
            pattern.includes(lastPart) ||
            patternNoAccent.includes(lastPart)) {
          return province.name;
        }
        // Thử tìm trong địa chỉ có dấu
        if (lastPartWithAccent.includes(pattern)) {
          return province.name;
        }
      }
    }
  }

  // Ưu tiên 2: Tìm trong toàn bộ địa chỉ - ưu tiên tên tỉnh thành
  const addressWithAccent = address.toLowerCase();
  for (const province of provinces) {
    // Kiểm tra tên tỉnh thành trực tiếp (có dấu) trong toàn bộ địa chỉ
    const provinceNameLower = province.name.toLowerCase();
    const provinceNameNoAccent = provinceNameLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Kiểm tra trong địa chỉ có dấu
    if (addressWithAccent.includes(provinceNameLower)) {
      // Kiểm tra xem tên tỉnh có xuất hiện ở cuối địa chỉ không (ưu tiên hơn)
      const provinceIndex = addressWithAccent.lastIndexOf(provinceNameLower);
      const afterProvince = addressWithAccent.substring(provinceIndex + provinceNameLower.length).trim();
      // Nếu tên tỉnh ở cuối hoặc sau tên tỉnh chỉ còn ít ký tự, thì đây là tỉnh thành
      if (afterProvince.length < 5 || afterProvince.match(/^[,.\s]*$/)) {
        return province.name;
      }
    }
    
    // Kiểm tra trong địa chỉ không dấu
    if (addressNormalized.includes(provinceNameNoAccent)) {
      const provinceIndex = addressNormalized.lastIndexOf(provinceNameNoAccent);
      const afterProvince = addressNormalized.substring(provinceIndex + provinceNameNoAccent.length).trim();
      if (afterProvince.length < 5 || afterProvince.match(/^[,.\s]*$/)) {
        return province.name;
      }
    }
    
    // Kiểm tra các pattern
    for (const pattern of province.patterns) {
      const patternNoAccent = pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // Tìm kiếm pattern trong địa chỉ có dấu
      if (addressWithAccent.includes(pattern)) {
        const patternIndex = addressWithAccent.lastIndexOf(pattern);
        const afterPattern = addressWithAccent.substring(patternIndex + pattern.length).trim();
        if (afterPattern.length < 5 || afterPattern.match(/^[,.\s]*$/)) {
          return province.name;
        }
      }
      
      // Tìm kiếm pattern trong địa chỉ không dấu
      if (addressNormalized.includes(pattern) || addressNormalized.includes(patternNoAccent)) {
        const patternIndex = addressNormalized.lastIndexOf(pattern);
        const afterPattern = addressNormalized.substring(patternIndex + pattern.length).trim();
        if (afterPattern.length < 5 || afterPattern.match(/^[,.\s]*$/)) {
          return province.name;
        }
      }
    }
  }

  // Ưu tiên 3: Tìm kiếm linh hoạt hơn - tìm từ khóa tỉnh thành trong toàn bộ địa chỉ
  for (const province of provinces) {
    for (const pattern of province.patterns) {
      // Tìm kiếm với word boundary để tránh match nhầm
      const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(addressNormalized)) {
        return province.name;
      }
      // Thử tìm không có word boundary (cho các trường hợp đặc biệt)
      if (addressNormalized.includes(pattern)) {
        return province.name;
      }
    }
  }
  
  // Ưu tiên 4: Tìm kiếm các từ khóa địa danh phổ biến (quận, huyện, phường, xã, thị trấn)
  // và tìm tỉnh thành gần đó
  const districtKeywords = ['quan', 'huyen', 'phuong', 'xa', 'thi tran', 'thanh pho', 'tp', 'tinh'];
  for (const keyword of districtKeywords) {
    if (addressNormalized.includes(keyword)) {
      // Tìm tỉnh thành sau từ khóa
      const keywordIndex = addressNormalized.indexOf(keyword);
      const beforeKeyword = addressNormalized.substring(0, keywordIndex).trim();
      const afterKeyword = addressNormalized.substring(keywordIndex + keyword.length).trim();
      
      // Tìm trong phần trước và sau từ khóa
      for (const province of provinces) {
        for (const pattern of province.patterns) {
          if (beforeKeyword.includes(pattern) || afterKeyword.includes(pattern)) {
            return province.name;
          }
        }
      }
    }
  }

  // Nếu không tìm thấy, thử tìm các từ khóa đặc biệt
  // Ví dụ: "Thành phố", "Tỉnh", "TP", "TP."
  const cityKeywords = ['thanh pho', 'tp', 'tp.', 'tinh', 'tỉnh'];
  
  for (const keyword of cityKeywords) {
    if (addressNormalized.includes(keyword)) {
      // Tìm tên tỉnh thành sau từ khóa
      const keywordIndex = addressNormalized.indexOf(keyword);
      const afterKeyword = addressNormalized.substring(keywordIndex + keyword.length).trim();
      for (const province of provinces) {
        for (const pattern of province.patterns) {
          if (afterKeyword.includes(pattern)) {
            return province.name;
          }
        }
      }
    }
  }
  
  // Ưu tiên 5: Tìm kiếm các từ khóa số (ví dụ: "Hà Nội 1", "HCM 2") và tên tỉnh thành ngắn gọn
  // Tách địa chỉ thành các từ và tìm kiếm
  const words = addressNormalized.split(/[\s,.\-]+/).filter(w => w.length > 2);
  for (const word of words) {
    for (const province of provinces) {
      for (const pattern of province.patterns) {
        // Kiểm tra nếu từ khớp với pattern (không cần exact match)
        if (word.includes(pattern) || pattern.includes(word)) {
          return province.name;
        }
      }
    }
  }

  // Log warning only in development mode
  logger.warn(`⚠️ [RegionExtractor] Không xác định được khu vực cho địa chỉ: "${address}"`);

  return 'Không xác định';
}

