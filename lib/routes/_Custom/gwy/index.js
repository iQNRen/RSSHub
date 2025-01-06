const got = require('@/utils/got');
const cheerio = require('cheerio');
const axios = require('axios');
const article = require('@/routes/digitaling/article');
const resolve_url = require('url').resolve;

const articleApi = 'http://dl.scs.gov.cn/api/article/' // 文章
const apiMap = {
    zkgg: 'http://dl.scs.gov.cn/api/article/articlelist/all/8a81f6d09024e05b01914fc92ed90023/0000000062b7b2b60162bccdd5860007/1?_=1736156651242', // 招考公告
    zytz: 'http://dl.scs.gov.cn/api/article/articlelist/all/8a81f6d09024e05b01914fc92ed90023/0000000062b7b2b60162bcce3de20008/1?_=1736175454275', // 重要公告
    zcfg: 'http://dl.scs.gov.cn/api/article/articlelist/all/8a81f6d09024e05b01914fc92ed90023/0000000062b7b2b60162bcd1a324000d/1?_=1736175589199', // 政策法规
    kwwd: 'http://dl.scs.gov.cn/api/article/articlelist/all/8a81f6d09024e05b01914fc92ed90023/0000000062b7b2b60162bcd32bfe0011/1?_=1736175648339', // 考务问答
    zcwd: 'http://dl.scs.gov.cn/api/article/articlelist/all/8a81f6d09024e05b01914fc92ed90023/0000000062b7b2b60162bcd29fcf000f/1?_=1736175681157', // 政策问答
    jswd: 'http://dl.scs.gov.cn/api/article/articlelist/all/8a81f6d09024e05b01914fc92ed90023/0000000062b7b2b60162bcd2e8f70010/1?_=1736175752758', // 技术问答
    nlygg: 'http://dl.scs.gov.cn/api/article/articlelist/all/8a81f6d09024e05b01914fc92ed90023/0000000062b7b2b60162bcd0591c000b/1?_=1736175826283', // 录用公告
    msgk: 'http://dl.scs.gov.cn/api/article/articlelist/all/8a81f6d09024e05b01914fc92ed90023/0000000062b7b2b60162bccf480c000a/1?_=1736175784949' // 面试公告
};

const baseUrl = 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articledetail.html';

const linkMap = {
    zkgg: 'id=0000000062b7b2b60162bccd55ec0006&eid=0000000062b7b2b60162bccdd5860007', // 招考公告
    zytz: 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articlelist.html?id=0000000062b7b2b60162bccd55ec0006&eid=0000000062b7b2b60162bcce3de20008', // 重要公告
    zcfg: 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articlelist.html?id=0000000062b7b2b60162bcd13002000c&eid=0000000062b7b2b60162bcd1a324000d', // 政策法规
    kwwd: 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articlelist.html?id=0000000062b7b2b60162bcd208c5000e&eid=0000000062b7b2b60162bcd32bfe0011', // 考务问答
    zcwd: 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articlelist.html?id=0000000062b7b2b60162bcd208c5000e&eid=0000000062b7b2b60162bcd29fcf000f', // 政策问答
    jswd: 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articlelist.html?id=0000000062b7b2b60162bcd208c5000e&eid=0000000062b7b2b60162bcd2e8f70010', // 技术问答
    nlygg: 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articlelist.html?id=0000000062b7b2b60162bccf03930009&eid=0000000062b7b2b60162bcd0591c000b', // 录用公告
    msgk: 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articlelist.html?id=0000000062b7b2b60162bccf03930009&eid=0000000062b7b2b60162bccf480c000a', // 面试公告
};

// 没想到是动图页面，需要用puppeteer。cheerio无法获取到

module.exports = async (ctx) => {
    // 并行处理所有链接
    const fetchTasks = Object.entries(apiMap).map(async ([type, link]) => {
        const response = await got.get(link);
        // const $ = cheerio.load(response.data.data);
        const $ = response.data.articleList;

        const timeList = $.map(item => new Date(item.pstrtime).toLocaleString());
        const list = $.map((item, index) => {
            let itemLink = `${baseUrl}?ArticleId=${item.id}&${linkMap[type]}`;
            let apiLink = `${articleApi}${item.id}`;
            return {
                title: item.articleTitle.trim() || '',
                link: itemLink,
                apiLink: apiLink,
                pubDate: timeList[index],
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
            ctx.cache.tryGet(item.apiLink, async () => {
                const newItem = {
                    ...item,
                    description: '',
                };

                const response = await got.get(item.apiLink)
                const $ = response.data.article.content;
                newItem.description = $ || '';
                return newItem;
            })
        )
    );
    console.log(items);

    // 构建最终的输出
    ctx.state.data = {
        title: '国家公务员局',
        item: items,
    };
};

