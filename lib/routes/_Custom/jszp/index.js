const got = require('@/utils/got');
const cheerio = require('cheerio');
const resolve_url = require('url').resolve;

const map = {
    huaan: 'huaan', // 华安
    fjnj: 'fjnj', // 南靖
    pinghe: 'pinghe', // 平和
    yunxiao: 'yunxiao', // 云霄
    zhangpu: 'zhangpu', // 漳浦
    changtai: 'changtai', // 长泰
    longhai: 'longhai', // 龙海
    lwq: 'lwq', // 龙文区
    dongshandao: 'dongshandao', // 东山县
    xc: 'xc', // 芗城区
    zhaoan: 'zhaoan', // 诏安县
};
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
    const type = ctx.params.type;
    const link = linkMap[type];

    const response = await got({
        method: 'get',
        url: link,
        headers: {
            Referer: link,
        },
    });

    const $ = cheerio.load(response.data);

    const timeList = $('.list-time')
        .toArray()
        .map((item) => $(item).text().trim());
    const list = $('.list-content')
        .toArray()
        .map((item, index) => {
            const cheerioItem = $(item);
            const a = cheerioItem.find('a');
            try {
                const title = a.text().trim() || '';
                let link = a.attr('href');
                if (!link) {
                    link = '';
                } else if (!link.startsWith('http')) {
                    link = resolve_url(`http://www.${map[type]}.gov.cn/`, link);
                }
                const pubDate = timeList[index];
                return {
                    title,
                    link,
                    pubDate,
                };
            } catch {
                return {
                    title: '',
                    link: '',
                    pubDate: new Date(),
                };
            }
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        list.map((item) =>
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

    ctx.state.data = {
        link,
        title: $('head > title').text(),
        item: items,
    };
};
