import PHP from "./index";

export function getPermissions(): Promise<string> {
    const script = `
        function getPermissions($navs) {
            $permissions = [];
            foreach ($navs as $nav) {
                $name = carr::get($nav, 'name');
                $subnav = carr::get($nav, 'subnav');
                $action = carr::get($nav, 'action');
                if ($name) {
                    $permissions[] = $name;
                }
                if (is_array($subnav)) {
                    $subnavPermissions = getPermissions($subnav);
                    $permissions = array_merge($permissions, $subnavPermissions);
                }
                if (is_array($action)) {
                    foreach ($action as $act) {
                        $actName = carr::get($act, 'name');
                        if ($actName) {
                            $permissions[] = $actName;
                        }
                    }
                }
            }

            return $permissions;
        }

        $permissions = [];
        $path = CF::appDir();
        $navPath = $path . DS . 'default' . DS . 'navs';
        $files = CFile::files($navPath);
        foreach ($files as $file) {
            // $fileName = str_replace('.php', '', $file->getFileName());
            $navs = include $file->getPathName();
            if (is_array($navs)) {
                $permissions = array_merge($permissions, getPermissions($navs));
            }
        }
        echo json_encode(array_filter($permissions));
    `;

    return PHP.run(script);
}
