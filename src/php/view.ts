import PHP from "./index";

export function getViews(): Promise<string> {
    const script = `
        function getViewsFromDirectory($directories, $filesystem, $parentDirectory = null) {
            $views = [];
            foreach ($directories as $directory) {
                $viewDirectory = basename($directory);
                if ($parentDirectory) {
                    $viewDirectory = $parentDirectory . '.' . $viewDirectory;
                }
                if ($filesystem->directories($directory)) {
                    $childDirectoryViews = getViewsFromDirectory(
                        $filesystem->directories($directory),
                        $filesystem, $viewDirectory
                    );
                    if ($childDirectoryViews) {
                        $views[] = $childDirectoryViews;
                    }
                }
                foreach ($filesystem->files($directory) as $file) {
                    if (!is_object($file) || !method_exists($file, 'getBaseName')) {
                        continue;
                    }
                    if (strpos($file->getBaseName(), '.blade.php')) {
                        $fileName = str_replace('.blade.php', '', $file->getBaseName());
                        $views[] = $viewDirectory . '.' . $fileName;
                    }
                }
            }
            return $views;
        }
        function getViews($path, $filesystem, $parentDirectory = null, $deluminator = '.'){
            $views = [];foreach ($filesystem->files($path) as $file) {
                if (!is_object($file) || !method_exists($file, 'getBaseName')) {
                    continue;
                }
                if (strpos($file->getBaseName(), '.blade.php')) {
                    $fileName = str_replace('.blade.php', '', $file->getBaseName());
                    $view = '';
                    if ($parentDirectory) {
                        $view = $parentDirectory . $deluminator;
                    }
                    $view .= $fileName;
                    $views = array_merge($views, [$view]);
                }
            }
            return array_merge($views, carr::flatten(getViewsFromDirectory($filesystem->directories($path), $filesystem)));
        }
        $filesystem = new CFile();
        $views = [];
        $paths = [CF::appDir() . DS . 'default' . DS . 'views'];
        $paths = array_merge(c::view()->getFinder()->getPaths(), $paths);
        foreach ($paths as $path) {
            $views = array_merge($views, getViews($path, $filesystem));
        }
        foreach (c::view()->getFinder()->getHints() as $namespace => $paths) {
            foreach ($paths as $path) {
                $views = array_merge($views, getViews($path, $filesystem, $namespace, '::'));
            }
        }
        echo json_encode($views);
        `;

    return PHP.run(script);
}
