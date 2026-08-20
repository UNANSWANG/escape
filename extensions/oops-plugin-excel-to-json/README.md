### 游戏配置数据生成插件
![Cocos Creator 3.x 配套游戏配置数据生成插件](https://img-blog.csdnimg.cn/0b3d49ff88ef46b0aad7e3835967c7ea.png)

### Cocos Creator 3.x 配置Excel文件目录、配置Json数据输出目录
![Cocos Creator 3.x 配置Excel文件目录、配置Json数据输出目录](https://img-blog.csdnimg.cn/8970f630863e44239c288c6ff8e44b32.png)


### Cocos Creator 3.x 扩展 -> Oops-Framework Excel To Json
![Cocos Creator 3.x 扩展 -> Oops-Framework Excel To Json](https://img-blog.csdnimg.cn/b5abda11872b4408a34801afb62024f1.png)

### Cocos Creator 3.x 生成Json数据资源
![Cocos Creator 3.x 生成Json数据资源](https://img-blog.csdnimg.cn/52a312d076464e719bde2c3d48acfd49.png)

工具指向策划配置表目录后，每次更新配置时，一键生成Json数据。

### Excel中数据规则
- Excel中前三行为工具规则数据
- 第一行为字段中文名
- 第二行为字段英文名，会生成为json数据的字段名
- 第三行为字段数据类型，只支持number、string类型，数组和对象类型可自行扩展
- 第四行开始为表格数据，所有字段都会导出
- 支持读取公式单元格中已保存的计算结果；公式修改后需使用 Excel/WPS 重新计算并保存文件
- 数据区中没有主键的空行会自动跳过，不影响整张表导出
