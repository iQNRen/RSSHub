const got = require('@/utils/got');
const cheerio = require('cheerio');
const resolve_url = require('url').resolve;

// const map = {
//     huaan: 'huaan', // 华安
//     fjnj: 'fjnj', // 南靖
//     pinghe: 'pinghe', // 平和
//     yunxiao: 'yunxiao', // 云霄
//     zhangpu: 'zhangpu', // 漳浦
//     changtai: 'changtai', // 长泰
//     longhai: 'longhai', // 龙海
//     lwq: 'lwq', // 龙文区
//     dongshandao: 'dongshandao', // 东山县
//     xc: 'xc', // 芗城区
//     zhaoan: 'zhaoan', // 诏安县
// };
const linkMap = {
    huaan: 'http://www.huaan.gov.cn/cms/html/haxrmzf/jyzc/index.html',
    fjnj: 'http://www.fjnj.gov.cn/cms/html/njxrmzf/jszl/index.html',
    pinghe: 'http://www.pinghe.gov.cn/cms/html/phxrmzf/jszl/index.html',
    yunxiao: 'http://www.yunxiao.gov.cn/cms/html/yxxrmzf/jyxx1/index.html',
    zhangpu: 'http://www.zhangpu.gov.cn/cms/html/zpxrmzf/jszl/index.html',
    changtai: 'http://www.changtai.gov.cn/cms/html/ctxrmzf/jyxx/index.html',
    longhai: 'http://www.longhai.gov.cn/cms/html/lhqrmzf/jszl/index.html',
    lwq: 'http://www.lwq.gov.cn/cms/html/lwqrmzf/jyxx/index.html',
    dongshandao: 'http://www.dongshandao.gov.cn/cms/html/dsxrmzf/jszp/index.html',
    xc: 'http://www.xc.gov.cn/cms/html/xcqrmzf/jszl/index.html',
    zhaoan: 'http://www.zhaoan.gov.cn/cms/sitemanage/index.shtml?siteId=830612491159490002',
};


module.exports = async (ctx) => {
    // 并行处理所有链接
    const fetchTasks = Object.entries(linkMap).map(async ([type, link]) => {
        const response = await got({
            method: 'get',
            url: link,
            headers: {
                Referer: link,
            },
        });
        const $ = cheerio.load(response.data);
        const timeList = $('.list-time').toArray().map(item => $(item).text().trim());
        const list = $('.list-content').toArray().map((item, index) => {
            const cheerioItem = $(item);
            const a = cheerioItem.find('a');
            let itemLink = a.attr('href');
            if (itemLink && !itemLink.startsWith('http')) {
                itemLink = resolve_url(`http://www.${type}.gov.cn/`, itemLink);
            }
            return {
                title: a.text().trim() || '',
                link: itemLink,
                pubDate: new Date(timeList[index]),
                type: type,
            };
        }).filter(item => item.title && item.link);
        return list;
    });

    let items = await Promise.all(fetchTasks);
    // 扁平化数组并根据 pubDate 排序
    items = items.flat().sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    items = await Promise.all(
        items.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const newItem = {
                    ...item,
                    description: '',
                };
                const response = await got({
                    method: 'get',
                    url: item.link,
                    headers: {
                        Referer: item.link,
                    },
                });
                const $ = cheerio.load(response.data);
                newItem.description = $('.content').html() || '';
                return newItem;
            })
        )
    );
    console.log(items);

    // 构建最终的输出
    ctx.state.data = {
        title: '漳州市教师招聘',
        item: items,
    };
};

