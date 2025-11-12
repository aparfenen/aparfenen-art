#!/usr/bin/env python3
"""
Скрипт для реорганизации файлов галереи по новым Themes категориям.
1. Читает gallery_metadata.csv
2. Создает папки для каждой темы в Themes
3. Копирует файлы из старых категорий в новые темы
4. Обновляет CSV с новыми путями
"""

import pandas as pd
import os
import shutil
from pathlib import Path

# Конфигурация
CSV_PATH = "gallery_metadata.csv"
OLD_IMG_DIR = "img"  # Папка со старыми категориями
NEW_IMG_DIR = "img_by_themes"  # Новая папка с темами
BACKUP_CSV = "gallery_metadata_backup.csv"

# Маппинг старых категорий на новые темы
# Если нужно, можно вручную настроить
CATEGORY_TO_THEME_MAP = {
    # Старая категория -> Тема (будет взята из CSV, но можно переопределить)
}

def main():
    print("🎨 Начинаем реорганизацию файлов по Themes\n")
    
    # 1. Создаем backup CSV
    if os.path.exists(CSV_PATH):
        shutil.copy(CSV_PATH, BACKUP_CSV)
        print(f"✓ Создан backup: {BACKUP_CSV}\n")
    
    # 2. Читаем CSV
    df = pd.read_csv(CSV_PATH, sep=',')
    print(f"✓ Загружено {len(df)} записей из CSV\n")
    
    # 3. Получаем уникальные темы
    themes = df['themes'].dropna().unique()
    themes = [t.strip() for t in themes if t.strip()]
    print(f"✓ Найдено {len(themes)} уникальных тем:")
    for theme in themes:
        print(f"  - {theme}")
    print()
    
    # 4. Создаем папки для тем
    Path(NEW_IMG_DIR).mkdir(exist_ok=True)
    for theme in themes:
        theme_dir = Path(NEW_IMG_DIR) / theme
        theme_dir.mkdir(exist_ok=True)
        print(f"✓ Создана папка: {theme_dir}")
    print()
    
    # 5. Копируем файлы
    copied = 0
    skipped = 0
    errors = []
    
    for idx, row in df.iterrows():
        old_category = row['category'].strip()
        filename = row['filename'].strip()
        theme = str(row['themes']).strip()
        
        if not theme or theme == 'nan':
            skipped += 1
            continue
        
        old_path = Path(OLD_IMG_DIR) / old_category / filename
        new_path = Path(NEW_IMG_DIR) / theme / filename
        
        if old_path.exists():
            try:
                shutil.copy2(old_path, new_path)
                copied += 1
                
                # Обновляем путь в CSV
                df.at[idx, 'category'] = theme
                
                if copied % 10 == 0:
                    print(f"  Скопировано {copied} файлов...")
            except Exception as e:
                errors.append(f"Ошибка при копировании {filename}: {e}")
        else:
            errors.append(f"Файл не найден: {old_path}")
    
    print(f"\n✓ Скопировано файлов: {copied}")
    print(f"⚠ Пропущено (нет темы): {skipped}")
    
    if errors:
        print(f"\n❌ Ошибки ({len(errors)}):")
        for error in errors[:10]:  # Показываем только первые 10
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... и еще {len(errors) - 10} ошибок")
    
    # 6. Сохраняем обновленный CSV
    output_csv = "gallery_metadata_by_themes.csv"
    df.to_csv(output_csv, sep=',', index=False)
    print(f"\n✓ Сохранен обновленный CSV: {output_csv}")
    
    # 7. Инструкции
    print("\n" + "="*60)
    print("СЛЕДУЮЩИЕ ШАГИ:")
    print("="*60)
    print("1. Проверь папку img_by_themes/ - там все файлы по темам")
    print("2. Если всё ок, замени gallery_metadata.csv:")
    print(f"   mv {output_csv} {CSV_PATH}")
    print("3. Обнови пути в HTML:")
    print("   - Замени 'img/{category}/' на 'img_by_themes/{theme}/'")
    print("   - Или переименуй img_by_themes в img после удаления старой")
    print("4. Запусти generate_index.py для обновления сайта")
    print("\nBackup сохранен в:", BACKUP_CSV)
    print("="*60)

if __name__ == "__main__":
    main()
