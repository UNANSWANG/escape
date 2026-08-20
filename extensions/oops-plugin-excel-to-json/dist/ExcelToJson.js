"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const path_1 = __importDefault(require("path"));
const main_1 = require("./main");
const fs = require('fs');
const excel = require('exceljs');
/** 获取普通单元格值，公式单元格使用 Excel 文件中保存的计算结果。 */
function getCellValue(cell) {
    const value = cell.value;
    if (value != null && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) {
        if (value.result == null) {
            console.warn(`公式单元格 ${cell.address} 没有缓存计算结果，请使用 Excel/WPS 重新计算并保存文件`);
        }
        return value.result;
    }
    return value;
}
function isEmptyValue(value) {
    return value == null || value === "";
}
/**
 * Excel转Json数据
 * @param {*} src           读取的excel文件目录
 * @param {*} dst           导出的json文件目录
 */
async function convert(src, dst) {
    let r = {};
    let names = []; // 文名字段名
    let keys = []; // 字段名
    let types = []; // 通用字段数据类型
    let primary = []; // 多主键配置
    let primary_index = [];
    const workbook = new excel.Workbook();
    // 读取excel
    await workbook.xlsx.readFile(src);
    const worksheet = workbook.getWorksheet(1); // 获取第一个worksheet 
    worksheet.eachRow((row, rowNumber) => {
        let data = {};
        let name = "";
        row.eachCell((cell, colNumber) => {
            const value = getCellValue(cell);
            if (rowNumber === 1) { // 字段中文名
                names.push(value);
                if (value.indexOf("【KEY】") > -1)
                    primary_index.push(colNumber);
            }
            else if (rowNumber === 2) { // 字段英文名
                keys.push(value);
                if (primary_index.indexOf(colNumber) > -1)
                    primary.push(value);
            }
            else if (rowNumber === 3) { // 通用字段数据类型
                types.push(value);
            }
            else {
                let index = colNumber - 1;
                let type = types[index];
                let key = keys[index];
                switch (type) {
                    case "int":
                        data[key] = parseFloat(value);
                        break;
                    case "float":
                        data[key] = parseFloat(value);
                        break;
                    case "string":
                        data[key] = value;
                        break;
                    case "any":
                        data[key] = JSON.parse(value);
                        break;
                }
            }
        });
        // 生成数据（多主键）
        if (rowNumber > 3) {
            const primaryValues = primary.map((key) => data[key]);
            if (primaryValues.every(isEmptyValue)) {
                return;
            }
            if (primaryValues.some(isEmptyValue)) {
                console.warn(`第 ${rowNumber} 行主键不完整，已跳过`);
                return;
            }
            let temp = null;
            for (var i = 0; i < primary.length; i++) {
                let k = primary[i];
                let id = data[k];
                delete data[k]; // 主键数据删除
                if (primary.length == 1) {
                    r[id] = data;
                }
                else {
                    if (i == primary.length - 1) {
                        temp[id] = data;
                    }
                    else if (i == 0) {
                        if (r[id] == undefined) {
                            r[id] = {};
                        }
                        temp = r[id];
                    }
                    else {
                        temp[id] = {};
                        temp = temp[id];
                    }
                }
            }
        }
    });
    // 写入流
    await fs.writeFileSync(dst, JSON.stringify(r));
    console.log("表格数据生成成功", dst);
}
async function run() {
    var inputExcelPath = path_1.default.join(__dirname, main_1.config.PathExcel);
    var outJsonPath = path_1.default.join(__dirname, main_1.config.PathJson);
    const files = fs.readdirSync(inputExcelPath);
    for (const f of files) {
        let name = f.substring(0, f.indexOf("."));
        let ext = f.toString().substring(f.lastIndexOf(".") + 1);
        if (ext == "xlsx") {
            await convert(inputExcelPath + f, outJsonPath + name + ".json");
        }
    }
}
exports.run = run;
