import PHP from "./index";

export function getConfigElements() {
    const script = `
        class ConfigTransformer {
            protected $items = [];
            public function __construct(){
                $this->items = c::collect();
            }
            public function transform($keys, $alias = ''){
                return c::collect($keys)->map(function ($keys, $index) use ($alias) {
                    if ($alias) {
                        $alias = $alias .'.';
                    }
                    if (! is_string($index)) {
                        return;
                    }
                    $alias .= $index;
                    if (is_array($keys)) {
                        return $this->transform($keys, $alias);
                    } else {
                        $this->items->push($alias);
                        return $keys;
                    }
                });
            }
            public function all(): array{
                return $this->items->filter(function ($config, $key) {
                    return strpos($config, 'app.providers') === false
                        && strpos($config, 'filesystems.links') === false
                        && strpos($config, 'app.aliases') === false;
                })->toArray();
            }
        }
        $configs = CConfig::repository()->all();
        $config = new ConfigTransformer();
        $config->transform($configs);
        echo json_encode($config->all());
    `;

    return PHP.run(script);
}



export async function getConfig(key:string) {
    const script = `
        echo json_encode(CF::config('`+key+`'));
    `;

    const out = await PHP.run(script);
    if(out) {
        return JSON.parse(out);
    }
    return null;
}
