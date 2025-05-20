import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Typography
} from '@mui/material';
import * as XLSX from 'xlsx';

function App() {
  // Raw data states
  const [hoglundData, setHoglundData] = useState(null);
  const [metaData, setMetaData] = useState(null);
  const [swaggerData, setSwaggerData] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('all');
  const [filteredData, setFilteredData] = useState(null);

  // Fetch JSON files on mount
  useEffect(() => {
    Promise.all([
      fetch('/hoglundData1.json').then(r => r.json()),
      fetch('/metaIngest_from_NT.json').then(r => r.json()),
      fetch('/fullTags.json').then(r => r.json())
    ])
      .then(([rawH, rawM, rawS]) => {
        //const hData = Array.isArray(rawH) ? rawH[0] : rawH;
        //setHoglundData(hData);
        // grab the first object, then drop Created/Modified/GUID/OSNUMBER/UPDAYS
        const rawObj = Array.isArray(rawH) ? rawH[0] : rawH;
        const {
          Created,
          Modified,
          GUID,
          OSNUMBER,
          UPDAYS,
          ...sensorOnly
        } = rawObj;
        setHoglundData(sensorOnly);
        setMetaData(Object.fromEntries(rawM.map(item => [item.tag, item.metadata])));
        setSwaggerData(rawS);
      })
      .catch(err => console.error('Error loading JSON:', err));
  }, []);

  // Build lookup for swagger
  const swaggerMap = useMemo(
    () => (swaggerData ? Object.fromEntries(swaggerData.map(item => [item.sourceTag, item])) : {}),
    [swaggerData]
  );

  // Tag lists
  const hoglundTags = useMemo(() => (hoglundData ? Object.keys(hoglundData) : []), [hoglundData]);
  const metaTags = useMemo(() => (metaData ? Object.keys(metaData) : []), [metaData]);
  const swaggerTags = useMemo(() => (swaggerData ? swaggerData.map(s => s.sourceTag) : []), [swaggerData]);
  const allTags = useMemo(
    () => Array.from(new Set([...hoglundTags, ...metaTags, ...swaggerTags])),
    [hoglundTags, metaTags, swaggerTags]
  );

  // Difference sets
  const onlyInHoglund = useMemo(() => allTags.filter(t => hoglundData?.[t] && !metaData?.[t]), [allTags, hoglundData, metaData]);
  const onlyInMeta = useMemo(() => allTags.filter(t => metaData?.[t] && !hoglundData?.[t]), [allTags, metaData, hoglundData]);
  const inBoth = useMemo(() => allTags.filter(t => hoglundData?.[t] && metaData?.[t]), [allTags, hoglundData, metaData]);

  // Master record merging sources and presence flags
  const masterRecord = useMemo(
    () =>
      Object.fromEntries(
        allTags.map(tag => {
          const rec = hoglundData?.[tag] || {};
          const meta = metaData?.[tag] || {};
          const sw = swaggerMap[tag] || null;
          return [
            tag,
            {
              ...rec,
              metadata: meta,
              swagger: sw,
              hasHoglund: !!hoglundData?.[tag],
              hasMeta: !!metaData?.[tag],
              hasSwagger: !!swaggerMap[tag]
            }
          ];
        })
      ),
    [allTags, hoglundData, metaData, swaggerMap]
  );

  // Units list
  const units = useMemo(() => {
    const u1 = hoglundData ? Object.values(hoglundData).map(e => e.UNIT) : [];
    const u2 = metaData ? Object.values(metaData).map(m => m.unit?.unitSymbol) : [];
    const u3 = swaggerData ? swaggerData.map(s => s.metaUnit) : [];
    return Array.from(new Set([...u1, ...u2, ...u3].filter(Boolean)));
  }, [hoglundData, metaData, swaggerData]);

  // Apply filters
  useEffect(() => {
    if (!hoglundData || !metaData || !swaggerData) return;
    const lower = searchTerm.toLowerCase();
    const entries = Object.entries(masterRecord).filter(([tag, rec]) => {
      const matchesSearch =
        tag.toLowerCase().includes(lower) ||
        rec.DESCR?.toLowerCase().includes(lower) ||
        rec.metadata?.description?.toLowerCase().includes(lower) ||
        rec.swagger?.metaDescription?.toLowerCase().includes(lower);
      const matchesUnit =
        !unitFilter || rec.UNIT === unitFilter || rec.metadata?.unit?.unitSymbol === unitFilter || rec.swagger?.metaUnit === unitFilter;
      const matchesDiff =
        diffFilter === 'all' ||
        (diffFilter === 'both' && inBoth.includes(tag)) ||
        (diffFilter === 'onlyHoglund' && onlyInHoglund.includes(tag)) ||
        (diffFilter === 'onlyMeta' && onlyInMeta.includes(tag));
      return matchesSearch && matchesUnit && matchesDiff;
    });
    setFilteredData(Object.fromEntries(entries));
  }, [searchTerm, unitFilter, diffFilter, masterRecord, hoglundData, metaData, swaggerData, inBoth, onlyInHoglund, onlyInMeta]);

  // Counts for summary
  const hoglundTotal = hoglundTags.length;
  const metaTotal = metaTags.length;
  const swaggerTotal = swaggerTags.length;

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredData) return;
    const rows = Object.entries(filteredData).map(([tag, rec]) => ({
      Tag: tag,
      Description: rec.DESCR || rec.metadata?.name || rec.swagger?.metaDescription,
      Value: rec.VALUE || rec.swagger?.lastValue,
      Status: rec.STATUS,
      Unit: rec.UNIT || rec.metadata?.unit?.unitSymbol || rec.swagger?.metaUnit,
      Created: rec.CREATED?.$date
        ? new Date(rec.CREATED.$date).toLocaleString()
        : rec.swagger?.lastTimeStamp
        ? new Date(rec.swagger.lastTimeStamp).toLocaleString()
        : '',
      Hoglund: rec.hasHoglund ? '✓' : '',
      Meta: rec.hasMeta ? '✓' : '',
      Swagger: rec.hasSwagger ? '✓' : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
    XLSX.writeFile(wb, 'comparison.xlsx');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Multi-Source Tag Comparison
      </Typography>

      {/* Filters & Export */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Søk"
          variant="outlined"
          sx={{ flex: 1 }}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Enhet</InputLabel>
          <Select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} label="Enhet">
            <MenuItem value="">Alle</MenuItem>
            {units.map(u => (
              <MenuItem key={u} value={u}>{u}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Difference</InputLabel>
          <Select value={diffFilter} onChange={e => setDiffFilter(e.target.value)} label="Difference">
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="both">I begge</MenuItem>
            <MenuItem value="onlyHoglund">Kun Høglund</MenuItem>
            <MenuItem value="onlyMeta">Kun Meta</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={exportToExcel} disabled={!filteredData}>
          Eksporter alle
        </Button>
      </Box>

      {/* Summary */}
      <Box sx={{ mb: 2 }}>
        <Typography>
          Hoglund: {hoglundTotal} | Meta: {metaTotal} | Swagger: {swaggerTotal} | I begge: {inBoth.length} | Kun Høglund: {onlyInHoglund.length} | Kun Meta: {onlyInMeta.length}
        </Typography>
      </Box>

      {/* Data Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tag</TableCell>
              <TableCell>Beskrivelse</TableCell>
              <TableCell>Verdi</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Enhet</TableCell>
              <TableCell>Opprettet</TableCell>
              <TableCell>Høglund?</TableCell>
              <TableCell>Meta?</TableCell>
              <TableCell>Swagger?</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData &&
              Object.entries(filteredData).map(([tag, rec]) => (
                <TableRow key={tag}>
                  <TableCell>{tag}</TableCell>
                  <TableCell>{rec.DESCR || rec.metadata?.name || rec.swagger?.metaDescription}</TableCell>
                  <TableCell>{rec.VALUE || rec.swagger?.lastValue}</TableCell>
                  <TableCell>{rec.STATUS}</TableCell>
                  <TableCell>{rec.UNIT || rec.metadata?.unit?.unitSymbol || rec.swagger?.metaUnit}</TableCell>
                  <TableCell>
                    {rec.CREATED?.$date
                      ? new Date(rec.CREATED.$date).toLocaleString()
                      : rec.swagger?.lastTimeStamp
                      ? new Date(rec.swagger.lastTimeStamp).toLocaleString()
                      : ''}
                  </TableCell>
                  <TableCell>{rec.hasHoglund ? '✓' : ''}</TableCell>
                  <TableCell>{rec.hasMeta ? '✓' : ''}</TableCell>
                  <TableCell>{rec.hasSwagger ? '✓' : ''}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default App;
