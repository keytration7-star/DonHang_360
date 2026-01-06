#!/bin/bash

# Script để cleanup codebase
# 1. Update imports từ old paths sang new paths
# 2. Xóa duplicate files
# 3. Xóa empty directories

echo "🧹 Bắt đầu cleanup..."

# Update imports trong tất cả files
echo "📝 Đang update imports..."

# Update imports từ old services sang new core/services
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's|from.*['"'"'"]\.\.\/services\/multiShopApiService|from "../../core/services/multiShopApiService|g' \
  -e 's|from.*['"'"'"]\.\.\/services\/pancakeApiService|from "../../core/api/pancakeApiService|g' \
  -e 's|from.*['"'"'"]\.\.\/services\/apiCacheService|from "../../core/cache/apiCacheService|g' \
  -e 's|from.*['"'"'"]\.\.\/services\/pancakeConfigService|from "../../core/services/pancakeConfigService|g' \
  -e 's|from.*['"'"'"]\.\.\/services\/incrementalUpdateService|from "../../core/services/incrementalUpdateService|g' \
  {} \;

# Update imports từ old store sang new core/store
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's|from.*['"'"'"]\.\.\/store\/apiOrderStore|from "../../core/store/apiOrderStore|g' \
  -e 's|from.*['"'"'"]\.\.\/store\/progressStore|from "../../core/store/progressStore|g' \
  {} \;

# Update imports từ old utils sang new shared/utils
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's|from.*['"'"'"]\.\.\/utils\/logger|from "../../shared/utils/logger|g' \
  -e 's|from.*['"'"'"]\.\.\/utils\/orderUtils|from "../../shared/utils/orderUtils|g' \
  -e 's|from.*['"'"'"]\.\.\/utils\/pancakeOrderMapper|from "../../shared/utils/pancakeOrderMapper|g' \
  {} \;

# Update imports từ old types sang new shared/types
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's|from.*['"'"'"]\.\.\/types\/order|from "../../shared/types/order|g' \
  -e 's|from.*['"'"'"]\.\.\/types\/pancakeApi|from "../../shared/types/pancakeApi|g' \
  {} \;

# Update imports từ old components sang new shared/components
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's|from.*['"'"'"]\.\.\/components\/Layout|from "../../shared/components/Layout|g' \
  -e 's|from.*['"'"'"]\.\.\/components\/LockScreen|from "../../shared/components/LockScreen|g' \
  -e 's|from.*['"'"'"]\.\.\/components\/ErrorBoundary|from "../../shared/components/ErrorBoundary|g' \
  {} \;

# Update imports từ old hooks sang new shared/hooks
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's|from.*['"'"'"]\.\.\/hooks\/useAutoFocus|from "../../shared/hooks/useAutoFocus|g' \
  -e 's|from.*['"'"'"]\.\.\/hooks\/useDebounce|from "../../shared/hooks/useDebounce|g' \
  {} \;

# Update imports từ old contexts sang new shared/contexts
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's|from.*['"'"'"]\.\.\/contexts\/ThemeContext|from "../../shared/contexts/ThemeContext|g' \
  {} \;

echo "✅ Đã update imports"

# Xóa duplicate files
echo "🗑️ Đang xóa duplicate files..."

# Xóa duplicate services
rm -f src/services/multiShopApiService.ts
rm -f src/services/pancakeApiService.ts
rm -f src/services/apiCacheService.ts
rm -f src/services/pancakeConfigService.ts
rm -f src/services/incrementalUpdateService.ts

# Xóa duplicate store
rm -f src/store/apiOrderStore.ts
rm -f src/store/progressStore.ts

# Xóa duplicate utils
rm -f src/utils/logger.ts
rm -f src/utils/orderUtils.ts
rm -f src/utils/pancakeOrderMapper.ts

# Xóa duplicate types
rm -f src/types/order.ts
rm -f src/types/pancakeApi.ts

# Xóa duplicate components
rm -f src/components/Layout.tsx
rm -f src/components/LockScreen.tsx
rm -f src/components/ErrorBoundary.tsx
rm -f src/components/ApiSettings.tsx

# Xóa duplicate hooks
rm -f src/hooks/useAutoFocus.ts
rm -f src/hooks/useDebounce.ts

# Xóa duplicate contexts
rm -f src/contexts/ThemeContext.tsx

echo "✅ Đã xóa duplicate files"

# Xóa empty directories
echo "🗑️ Đang xóa empty directories..."
find src -type d -empty -delete
echo "✅ Đã xóa empty directories"

echo "🎉 Cleanup hoàn tất!"

