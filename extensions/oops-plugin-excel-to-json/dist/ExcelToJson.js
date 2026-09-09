"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const path_1 = __importDefault(require("path"));
const main_1 = require("./main");
const fs = require("fs");
const excel = require("exceljs");

function getCellValue(cell) {
    const value = cell.value;
    if (value != null && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) {
        if (value.result == null) {
            console.warn(`Formula cell ${cell.address} has no cached result. Recalculate and save the Excel/WPS file.`);
        }
        return value.result;
    }
    return value;
}

function isEmptyValue(value) {
    return value == null || value === "";
}

async function convert(src, dst) {
    const rows = [];
    const keys = [];
    const types = [];
    const workbook = new excel.Workbook();
    await workbook.xlsx.readFile(src);
    const worksheet = workbook.getWorksheet(1);
    worksheet.eachRow((row, rowNumber) => {
        const data = {};
        row.eachCell((cell, colNumber) => {
            const value = getCellValue(cell);
            if (rowNumber === 2) {
                keys.push(value);
            }
            else if (rowNumber === 3) {
                types.push(value);
            }
            else if (rowNumber > 3) {
                const index = colNumber - 1;
                const key = keys[index];
                switch (types[index]) {
                    case "int":
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
        if (rowNumber > 3 && Object.values(data).some((value) => !isEmptyValue(value))) {
            rows.push(data);
        }
    });
    fs.writeFileSync(dst, JSON.stringify(rows), "utf8");
    console.log("Excel data generated successfully", dst);
}

async function run() {
    const inputExcelPath = path_1.default.join(__dirname, main_1.config.PathExcel);
    const outJsonPath = path_1.default.join(__dirname, main_1.config.PathJson);
    const files = fs.readdirSync(inputExcelPath);
    for (const f of files) {
        const name = f.substring(0, f.indexOf("."));
        const ext = f.toString().substring(f.lastIndexOf(".") + 1);
        if (ext === "xlsx") {
            await convert(inputExcelPath + f, outJsonPath + name + ".json");
        }
    }
}
exports.run = run;
