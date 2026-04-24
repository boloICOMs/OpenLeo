<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform" 
    xmlns:tei="http://www.tei-c.org/ns/1.0"
    exclude-result-prefixes="tei">
    
    <xsl:output method="html" indent="yes" encoding="UTF-8"/>
    
    <xsl:param name="pageId" />
    <xsl:param name="editionType" select="'diplomatic'"/>

    <xsl:template match="/">
        <div class="manuscript-page-sheet">
            <div class="tei-transcription">
                <xsl:apply-templates select="//tei:pb[@facs=$pageId]"/>
            </div>
        </div>
    </xsl:template>

    <xsl:template match="tei:pb">
        <xsl:apply-templates select="following-sibling::node()[preceding-sibling::tei:pb[1]/@facs = $pageId and not(self::tei:pb)]" />
    </xsl:template>

    <xsl:template match="tei:div | tei:div[@type='transcription-container'] | tei:div[@type='column-left-2r'] | tei:div[@type='column-right-2r']">
        <xsl:choose>
            <xsl:when test="$editionType = 'critical'">
                <div class="critical-block-wrapper">
                    <xsl:apply-templates/>
                </div>
            </xsl:when>
            <xsl:otherwise>
                <div class="{@type}">
                    <xsl:apply-templates/>
                </div>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="tei:p">
        <xsl:choose>
            <xsl:when test="$editionType = 'critical'">
                <p class="critical-linear-text">
                    <xsl:apply-templates/>
                </p>
            </xsl:when>
            <xsl:otherwise>
                <p class="tei-lines">
                    <xsl:if test="@xml:id">
                        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
                    </xsl:if>
                    <xsl:apply-templates/>
                </p>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="tei:figure">
        <xsl:if test="$editionType != 'critical'">
            <div class="leonardo-figure">
                <xsl:if test="@xml:id">
                    <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
                </xsl:if>
                <xsl:attribute name="class"><xsl:value-of select="concat('leonardo-figure ', @place)"/></xsl:attribute>
                <img src="{tei:graphic/@url}" alt="{tei:figDesc}" />
            </div>
        </xsl:if>
    </xsl:template>

    <xsl:template match="tei:choice">
        <xsl:choose>
            <xsl:when test="$editionType = 'critical'">
                <span class="reg">
                    <xsl:choose>
                        <xsl:when test="tei:reg">
                            <xsl:apply-templates select="tei:reg"/>
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:apply-templates select="tei:expan | tei:abbr | tei:orig"/>
                        </xsl:otherwise>
                    </xsl:choose>
                </span>
            </xsl:when>

            <xsl:otherwise>
                <span class="abbr">
                    <xsl:if test="tei:expan">
                        <xsl:attribute name="title">
                            <xsl:value-of select="concat('Espansione: ', tei:expan)"/>
                        </xsl:attribute>
                    </xsl:if>
                    
                    <xsl:apply-templates select="tei:abbr | tei:orig"/>
                </span>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="tei:note[@type='critical']">
        <xsl:if test="$editionType = 'critical'">
            <sup class="note-ref"><xsl:value-of select="@n"/></sup>
        </xsl:if>
    </xsl:template>

    <xsl:template match="tei:del">
        <xsl:choose>
            <xsl:when test="$editionType = 'critical'">
                </xsl:when>
            <xsl:otherwise>
                <del><xsl:apply-templates/></del>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    
   <xsl:template match="tei:add">
        <xsl:choose>
            <xsl:when test="$editionType = 'diplomatic'">
                <span class="tei-add add-{@place}"><xsl:apply-templates/></span>
            </xsl:when>
            <xsl:otherwise>
                </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="tei:lb">
        <xsl:choose>
            <xsl:when test="$editionType = 'diplomatic'">
                <span class="lb-line"></span> </xsl:when>
            <xsl:otherwise>
                <xsl:text> </xsl:text>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="tei:pc">
        <xsl:choose>
            <xsl:when test="@type = 'diplomatic'">
                <xsl:if test="$editionType = 'diplomatic'">
                    <span class="punct-diplomatic">
                        <xsl:apply-templates/>
                    </span>
                </xsl:if>
            </xsl:when>

            <xsl:when test="@type = 'critical'">
                <xsl:if test="$editionType = 'critical'">
                    <span class="punct-critical">
                        <xsl:apply-templates/>
                    </span>
                </xsl:if>
            </xsl:when>

            <xsl:otherwise>
                <xsl:apply-templates/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="tei:seg"><span class="{@class}"><xsl:apply-templates/></span></xsl:template>
    <xsl:template match="tei:subst"><span class="subst"><xsl:apply-templates/></span></xsl:template>
    
  
    <xsl:template match="tei:metamark"><span class="tei-metamark"><xsl:apply-templates/><span class="caret">^</span></span></xsl:template>

</xsl:stylesheet>