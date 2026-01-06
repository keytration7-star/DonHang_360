// Script để debug React error #300
// Chạy trong browser console khi app bị lỗi

console.log('🔍 Debug React Error #300');
console.log('========================');

// Kiểm tra root element
const root = document.getElementById('root');
console.log('Root element:', root);
console.log('Root children count:', root?.children.length);
console.log('Root children:', Array.from(root?.children || []));

// Kiểm tra React component tree
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('React DevTools available');
} else {
  console.log('React DevTools NOT available');
}

// Kiểm tra HashRouter
const hashRouter = document.querySelector('[data-router]');
console.log('HashRouter element:', hashRouter);

// Kiểm tra multiple root elements
const allTopLevelDivs = Array.from(document.querySelectorAll('body > div, #root > div'));
console.log('Top level divs:', allTopLevelDivs.length);
allTopLevelDivs.forEach((div, index) => {
  console.log(`  Div ${index}:`, div.className, div);
});

// Kiểm tra React error
const errorElements = document.querySelectorAll('[class*="error"], [id*="error"]');
console.log('Error elements:', errorElements.length);

