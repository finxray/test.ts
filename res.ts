import moment from 'moment-timezone';
import { MARKET_CALENDAR, MarketCalendar } from './mh';

export type ChartRange = '1D' | '1W' | '1M' | '6M' | 'YTD' | '1Y' | '5Y' | 'Max' | 'Custom'; 
export type Timespan = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' |'year' ; 
export type Market = 'crypto' | 'fx' | 'stocks' | 'options';
export type Timezone = 'America/New_York' | "Europe/London";

export interface TradingHours { 
    from: string; 
    to: string; 
    tz: Timezone;
    earlyHours?: string; 
    afterHours?: string; 
    earlyClose?: {open: string, close: string, afterHoursClose: string};
} 

export interface TradingHoursByMarket { 
    crypto: TradingHours; 
    fx: TradingHours; 
    stocks: TradingHours; 
    options: TradingHours;
}

export interface RangeDates { 
    from: string; 
    to: string;
} 

/** BEG: for stocks and options  */
export type MarketStatus = 'open' | 'closed' |'earlyHours' | 'afterHours';
export type StockExchangeCalendarStatus = 'open' | 'closed' | 'early-close'; 

export interface MarketStatusByMarkets { 
    crypto: MarketStatus;
    fx: MarketStatus; 
    stocks: MarketStatus;
    options: MarketStatus;
} 
/** END: for stocks and options */

export var TRADING_HOURS_BY_MARKET: TradingHoursByMarket = { 
    crypto: {
        from: '00:00:00',
        to: '23:59:59', 
        tz: 'Europe/London'
    },
    fx: {
        from: '00:00:00',
        to: '23:59:59',
        tz: 'Europe/London'
    }, 
    stocks: {
        from: '09:30:00',
        to: '16:00:00',
        tz: 'America/New_York',
        earlyHours: '04:00:00',
        afterHours: '20:00:00', 
        earlyClose: {
            open: '09:30:00',
            close: '13:00:00',
            afterHoursClose: '17:00:00'
        }
        
    }, 
    options: {
        from: '09:30:00',
        to: '16:00:00',
        tz: 'America/New_York',
        earlyHours: '04:00:00',
        afterHours: '20:00:00',
        earlyClose: {
            open: '09:30:00',
            close: '13:00:00',
            afterHoursClose: '17:00:00'
        } 
    }
}



export function changeAllTimezone(newTimzone: Timezone, tHours: TradingHoursByMarket ): TradingHoursByMarket {
    let k: keyof TradingHoursByMarket;
    for(k in tHours){
        tHours[k].tz = newTimzone;
    }
    return tHours;
} 
export function changeMarketTimezone(newTimzone: Timezone, market: Market, tHours: TradingHoursByMarket) {
    tHours[market].tz = newTimzone; 
    return tHours;
}




export interface Resolution { 
    timespan: Timespan; 
    multiplier: number; 
    from: string; 
    to: string; 
}   


/**
 * optional parameters are only required for markets that are not continous such as stocks and options
 * for stocks and options all parameters are required but customDates.
 * @param chartRange 
 * @param market 
 * @param hours 
 * @param extendedHours only used for 1D range 
 * @param prevCloseDate unix in secs. 
 * @param customDates 'DD/MM/YYYY' format. For Max range the rage will be obtained in two steps. 1 request 50Y 
 * yeartly range find the earliest year than request repeat with precise dates. customDates
 * @returns 
 */
export function rangeDates(chartRange: ChartRange, market: Market, hours: TradingHoursByMarket,
        extendedHours?: boolean, prevCloseDate?: number, 
        status?: StockExchangeCalendarStatus, customDates?: RangeDates):  RangeDates | undefined { 
    const tz = hours[market].tz; 
    const fullFormat = 'DD/MM/YYYY HH:mm:ss'; 
    const open = hours[market].from;
    const close = hours[market].to;
    let earlyClose = hours[market]?.earlyClose?.close ?? close;
    let ehOpen = open;
    let ahClose = close;
    const m = moment.tz(hours[market].tz); // now 
    let start: any = '';
    let startDDMMYYYY = '';
    let end = moment.tz(hours[market].tz);
    if(extendedHours && hours[market].earlyHours && hours[market].afterHours) {
        ehOpen = hours[market]?.earlyHours ?? open; 
        ahClose = hours[market]?.afterHours ?? close;
        earlyClose = hours[market]?.earlyClose?.afterHoursClose ?? close;
    }
    switch(chartRange) { 
        case 'Custom': 
        case 'Max':
            if(customDates) {
                start = moment.tz(`${customDates.from} ${open}`, fullFormat, tz);      
                end = moment.tz(`${customDates.to} ${close}`, fullFormat, tz);     
            } else { 
                console.log(' custom Dates are not provided but required for Max and Custom ranges');
            }
        case 'YTD': 
            const currYear = m.format('YYYY');
            start = moment.tz(`01/01/${currYear} ${open}`, fullFormat, tz);     
            break;
        case '1D': 
            if(market === 'stocks' || market === 'options') { 
                if(prevCloseDate) {
                    let today = m.format('DD/MM/YYYY');
                    let _eHOpen = moment.tz(`${today} ${ehOpen}`, fullFormat, tz);
                    let _aHClose = moment.tz(`${today} ${ahClose}`, fullFormat, tz);
                    let prevClose = moment.unix(prevCloseDate).tz(tz).format('DD/MM/YYYY'); 
                    if(status === 'closed' || m.weekday() === 6 || m.weekday() === 0 || m < _eHOpen) {
                        start = moment.tz(`${prevClose} ${open}`, fullFormat, tz);
                        end =  moment.tz(`${prevClose} ${close}`, fullFormat, tz);
                    } else if (status === 'open') {
                        start = _eHOpen;
                        end = _aHClose;
                    } else if (status === 'early-close') { 
                        start = _eHOpen; 
                        end = moment.tz(`${today} ${earlyClose}`, fullFormat, tz);
                    }
                } else {
                    console.log(' exchanePrevCloseDate must be provided for stocks or options markets');
                } 
            } else  {
                let values = separateDigitsFromText(chartRange);
                startDDMMYYYY = m.subtract(values.digit, values.text).format('DD/MM/YYYY'); 
                start = moment.tz(`${startDDMMYYYY} ${open}`, fullFormat, tz);
            }
            break;
        default:   
            let values = separateDigitsFromText(chartRange);
            startDDMMYYYY = m.subtract(values.digit, values.text).format('DD/MM/YYYY'); 
            start = moment.tz(`${startDDMMYYYY} ${open}`, fullFormat, tz); 
    }            
    const startFormated = start.format('x');  
    const endFormated = end.format('x');  
    return {from: startFormated, to: endFormated}; 
}


/** feed the output to moment operations */
function separateDigitsFromText(text: ChartRange): {digit: any, text: any} { 
    const pattern = (/\d/g); 
    let num: any = text.match(pattern); 
    num = Number(num.join('')); 
    let t: string = text.replace(pattern, ''); 
    if(t !== 'M' && t !== 'Q'){
        t = t.toLowerCase();  
        if(t === 'd'){
            num -= 1; 
        }
    } 
    return {digit: num, text: t};
}  

export type StockExchanges = 'NYSE' | 'NASDAQ'; 
/**
 * 
 * @param exchange NYSE or NASDAQ
 * @param marketCalendar 
 * @param tz 
 * @returns unix number in seconds
 */
function exchangePrevCloseDate(marketCalendar: MarketCalendar[], tz: Timezone = 'America/New_York', 
        exchange: StockExchanges = 'NYSE'): number { 
    let tempToday = moment.unix(Date.now()/1000).tz(tz); 
    const status: StockExchangeCalendarStatus = 'closed';
    const maxIterations = 10;
    let prevCloseDate: any = '';
    while(prevCloseDate === '' || maxIterations < 10) {
        tempToday = tempToday.subtract(1, 'd'); 
        if(tempToday.weekday() < 6 && tempToday.weekday() > 0) {
            let d = tempToday.format('YYYY-MM-DD'); 
            let calDay: MarketCalendar | undefined =  marketCalendar.find((x: MarketCalendar) => 
                (x.date === d && x.exchange === exchange && x.status === status));
            !calDay ? prevCloseDate = tempToday : null;
        } 
    }
    return Number(prevCloseDate.tz(tz).format('X'));
} 


function stockExClndStatus(marketCalendar: MarketCalendar[], tz: Timezone = 'America/New_York', 
        exchange: StockExchanges = 'NYSE'): StockExchangeCalendarStatus { 
    const today = moment.unix(Date.now()/1000).tz(tz);
    let status: StockExchangeCalendarStatus | undefined;
    const stockExCalStatus: MarketCalendar | undefined = marketCalendar.find(x => 
        x.date === today.format('YYYY-MM-DD') && x.exchange === exchange);
    today.weekday() < 6 && today.weekday() > 0 ? (status = stockExCalStatus?.status ?? 'open') : (status = 'closed');
    return status;
}


// console.log('prevClose: ',exchangePrevCloseDate(MARKET_CALENDAR));
// console.log(stockExClndStatus(MARKET_CALENDAR)); 
const st = Date.now();
let prevClose = exchangePrevCloseDate(MARKET_CALENDAR); 
let status = stockExClndStatus(MARKET_CALENDAR); 
let dates: any = rangeDates('1W', 'options', TRADING_HOURS_BY_MARKET, false, prevClose, status); 

console.log(dates); 
console.log('GMT: ',moment.unix(Number(dates.from) /1000).tz('Europe/London').format('DD/MM/YYYY HH:mm:ss'));
console.log('GMT: ',moment.unix(Number(dates.to) / 1000).tz('Europe/London').format('DD/MM/YYYY HH:mm:ss')); 
console.log('NY: ',moment.unix(Number(dates.from) /1000).tz('America/New_York').format('DD/MM/YYYY HH:mm:ss'));
console.log('NY: ',moment.unix(Number(dates.to) / 1000).tz('America/New_York').format('DD/MM/YYYY HH:mm:ss')); 

interface Timespans { 
    minute: any;
    hour: any; 
    day: any;
    week: any;
    month: any;
    quarter: any;
    year: any;
}
const multipliers: Timespans = { 
    minute: [1,2,3,5,10,15,30],
    hour: [1,2,3,4,6,8,12],
    day: [1,2,3,4,5,6],
    week: [1,2],
    month: [1,2,3,4,6],
    quarter: [1,2],
    year: [1]
}; 
const timespans: Timespans = { 
    minute: 1,
    hour: 60,
    day: 1440, 
    week: 10080, 
    month: 43800,
    quarter: 131400, 
    year: 525600
};
// probably for all ranges but 1D
function calTimespanAndMultiplier(from: string, to: string, market: Market, range: ChartRange ) {
    const minPixels = [80, 70, 60, 55];
    const maxPixels = [120, 140, 160, 170];
    let multiplier; 
    let timespan;
    let min = (Number(to) - Number(from)) / (1000*60); 
    console.log('mins: ',min);
    let pixels = 0;
    let k: keyof Timespans;
    for(let j in minPixels) {
        for(k in timespans) {
            const mult = multipliers[k]; 
            for(let i in mult) {
                multiplier = mult[i]; 
                timespan = k;  
                let adjastment = 1;
                if((k === 'minute' || k === 'hour') && (market === 'options' || market === 'stocks') && range !== '1D') {
                    adjastment = 1 / (24 / 6.5);
                }
                pixels = (min * adjastment) / (mult[i] * timespans[k]); 
                if(pixels > minPixels[j] && pixels < maxPixels[j]) {
                    console.log('timespan: ', timespan); 
                    console.log('multiplier: ', multiplier); 
                    console.log('pixels: ', pixels);  
                    return {timespan: timespan, multiplier: multiplier, pixels: pixels};
                }
            }
        }
    
    }
} 

calTimespanAndMultiplier(dates.from, dates.to, 'crypto', '1W'); 
