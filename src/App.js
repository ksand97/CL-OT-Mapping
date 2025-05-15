import React, { useState, useEffect } from 'react';
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
  // State for raw data
  const [hoglundData, setHoglundData] = useState(null);
  const [metaData, setMetaData] = useState(null);
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('all');
  // Filtered output
  const [filteredData, setFilteredData] = useState(null);

  // 1) Fetch both JSONs on mount
  useEffect(() => {
    Promise.all([
      fetch('/hoglundData1.json').then(r => r.json()),
      fetch('/metaIngest_from_NT.json').then(r => r.json())
    ])
    .then(([rawHoglund, metaArray]) => {
      const hoglund = Array.isArray(rawHoglund) ? rawHoglund[0] : rawHoglund;
      const metaMap = Object.fromEntries(
        metaArray.map(item => [item.tag, item.metadata])
      );
      setHoglundData(hoglund);
      setMetaData(metaMap);
    })
    .catch(err => console.error('Error loading JSON:', err));
  }, []);

  // 2) Build lists and master record
  const allTags = hoglundData && metaData
    ? Array.from(
        new Set([...Object.keys(hoglundData), ...Object.keys(metaData)])
      )
    : [];
  const onlyInHoglund = allTags.filter(
    tag => hoglundData?.[tag] && !metaData?.[tag]
  );
  const onlyInMeta = allTags.filter(
    tag => metaData?.[tag] && !hoglundData?.[tag]
  );
  const inBoth = allTags.filter(
    tag => hoglundData?.[tag] && metaData?.[tag]
  );
  // Master record: merge Høglund entry, metadata, and diffType
  const masterRecord = Object.fromEntries(
    allTags.map(tag => {
      const entry = hoglundData?.[tag] || {};
      const diffType =
        hoglundData?.[tag] && metaData?.[tag]
          ? 'both'
          : hoglundData?.[tag]
          ? 'onlyHoglund'
          : 'onlyMeta';
      return [tag, { ...entry, metadata: metaData?.[tag] || null, diffType }];
    })
  );

  // 3) Unique units list for filter dropdown
  const units = hoglundData
    ? Array.from(
        new Set(Object.values(hoglundData).map(e => e.UNIT))
      )
    : [];

  // 4) Apply filters whenever inputs change
  useEffect(() => {
    if (!hoglundData || !metaData) return;
    const lower = searchTerm.toLowerCase();
    const filteredEntries = Object.entries(masterRecord).filter(
      ([tag, rec]) => {
        const matchesSearch =
          tag.toLowerCase().includes(lower) ||
          (rec.DESCR?.toLowerCase().includes(lower)) ||
          (rec.metadata?.description?.toLowerCase().includes(lower));
        const matchesUnit =
          unitFilter === '' || rec.UNIT === unitFilter;
        const matchesDiff =
          diffFilter === 'all' || rec.diffType === diffFilter;
        return matchesSearch && matchesUnit && matchesDiff;
      }
    );
    setFilteredData(Object.fromEntries(filteredEntries));
  }, [searchTerm, unitFilter, diffFilter, masterRecord, hoglundData, metaData]);

  // 5) Totals
  const totalTags = filteredData ? Object.keys(filteredData).length : 0;

  // 6) Export to Excel
  const exportToExcel = () => {
    if (!filteredData) return;
    const excelRows = Object.entries(filteredData).map(
      ([tag, rec]) => ({
        Tag: tag,
        Description: rec.DESCR,
        Value: rec.VALUE,
        Status: rec.STATUS,
        Unit: rec.UNIT,
        Created: rec.CREATED?.$date || '',
        Diff: rec.diffType
      })
    );
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
    XLSX.writeFile(wb, 'comparison.xlsx');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Høglund Meta Comparison
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
          <Select
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
            label="Enhet"
          >
            <MenuItem value="">Alle</MenuItem>
            {units.map(u => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Difference</InputLabel>
          <Select
            value={diffFilter}
            onChange={e => setDiffFilter(e.target.value)}
            label="Difference"
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="both">I begge</MenuItem>
            <MenuItem value="onlyHoglund">Kun Høglund</MenuItem>
            <MenuItem value="onlyMeta">Kun Meta</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={exportToExcel}
          disabled={totalTags === 0}
        >
          Eksporter Excel
        </Button>
      </Box>

      {/* Summary */}
      <Box sx={{ mb: 2 }}>
        <Typography>
          Totalt tags: {allTags.length} | I begge: {inBoth.length} | Kun Høglund: {onlyInHoglund.length} | Kun Meta: {onlyInMeta.length}
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
              <TableCell>Diff</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData &&
              Object.entries(filteredData).map(([tag, rec]) => (
                <TableRow key={tag}>
                  <TableCell>{tag}</TableCell>
                  <TableCell>{rec.DESCR || rec.metadata?.name}</TableCell>
                  <TableCell>{rec.VALUE}</TableCell>
                  <TableCell>{rec.STATUS}</TableCell>
                  <TableCell>{rec.UNIT || rec.metadata?.unit.unitSymbol}</TableCell>
                  <TableCell>
                    {rec.CREATED?.$date
                      ? new Date(rec.CREATED.$date).toLocaleString()
                      : ''}
                  </TableCell>
                  <TableCell>{rec.diffType}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default App;
