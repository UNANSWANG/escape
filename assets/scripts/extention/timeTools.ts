import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('timeTools')
export class timeTools {
    //以下数据都是秒为单位
    static Minute: number = 60;
    static Hour: number = 3600;
    static Day: number = 86400;
    /**获取第二天0点的时间*/
    getNextTimeStr() {
        // 获取当前时间
        let now = new Date();

        // 创建一个新的日期对象并设置为当前日期的0点
        let nextDayMidnight = new Date(now);
        nextDayMidnight.setDate(now.getDate() + 1);
        nextDayMidnight.setHours(0, 0, 0, 0);

        // 格式化日期
        let year = nextDayMidnight.getFullYear();
        let month = (nextDayMidnight.getMonth() + 1).toString().padStart(2, '0');
        let day = nextDayMidnight.getDate().toString().padStart(2, '0');
        let hour = '00';
        let minute = '00';

        // 组合成最终字符串
        let formattedDate = `${year}.${month}.${day} ${hour}:${minute}`;
        return formattedDate;
    }

    /** 获取当天0点的时间 */
    getCurrentTime() {
        let now = new Date();
        // 创建一个新的日期对象，设置为当天的0点
        let midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // 将日期对象转换为时间戳
        return Math.floor(midnight.getTime() / 1000);
    }

    /** 获取想个现在几天0点的时间 */
    getDayTime(num = 0) {
        let now = new Date();

        // 创建一个新的日期对象并设置为当前日期的0点
        let nextDayMidnight = new Date(now);
        nextDayMidnight.setDate(now.getDate() + num);
        nextDayMidnight.setHours(0, 0, 0, 0);
        return Math.floor(nextDayMidnight.getTime() / 1000);
    }

    /** 获取现在的时间(秒) */
    getTime() {
        let now = new Date();
        return Math.floor(now.getTime() / 1000);
    }

    /**获取新的时间 */
    getNewTime(min, hour = 0, day = 0) {
        let nowTime = this.getTime();
        nowTime = nowTime + min * timeTools.Minute + hour * timeTools.Hour + day * timeTools.Day;
        return nowTime;
    }

    /**获取当天剩余的时间 */
    getReminTimeStr(targetTime = 0) {
        let nowZero = targetTime;
        if (targetTime == 0) {
            nowZero = this.getDayTime(1);
        }
        let time = nowZero - this.getTime();
        if (time < 0) return '00:00';
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time - (hours * 3600)) / 60);
        const seconds = Math.floor((time - (hours * 3600) - (minutes * 60)));
        const hoursString = (hours === 0) ? '' : `${hours.toString().padStart(2, '0')}:`;
        return `${hoursString}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**获取当天的日期 */
    getDayDate(date?): string {
        if (!date) {
            date = new Date();
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要加1
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}年${month}月${day}日${hours}:${minutes}:${seconds}`;
    }

    /**格式化时间 */
    formatTime(seconds: number): string {
        const totalSeconds = Math.max(0, Math.ceil(seconds));
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**获取时间（yyyy.mm.dd） */
    getCurrentDateFormatted(): string {
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要+1
        const day = String(now.getDate()).padStart(2, '0');

        return `${year}.${month}.${day}`;
    }
}
export let ccTimeTools = new timeTools();
