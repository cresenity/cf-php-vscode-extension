import PHP from "./index";

export function getTranslations() {
    const script = `
        $translations = [];
        $paths = array_reverse(CF::paths());
        foreach ($paths as $path) {
            $translationPath = $path . 'i18n' . DIRECTORY_SEPARATOR;
            if (CFile::isDirectory($translationPath)) {
                $directories = CFile::directories($translationPath);
                foreach ($directories as $directory) {
                    $files = CFile::files($directory);
                    foreach ($files as $file) {
                        $fileName = str_replace('.php', '', $file->getFileName());
                        $fields = include $file->getPathName();
                        if (is_array($fields)) {
                            foreach ($fields as $field => $message) {
                                $translations[] = "{$fileName}.{$field}";
                                if ($fileName == 'core') {
                                    $translations[] = $field;
                                }
                            }
                        }
                    }
                }
            }
        }
        echo json_encode(array_filter($translations));
    `;

    return PHP.run(script);
}
